import Foundation
import WebKit

/// ZAMORIN CAFÉ ERP — macOS NATIVE MESSAGE BRIDGE
/// Implements Section 10 & 24 WKScriptMessageHandler protocol for macOS desktop.
public class ZamorinNativeBridge: NSObject, WKScriptMessageHandler {

    public protocol BridgeDelegate: AnyObject {
        func onRequestDirectoryPicker(requestId: String)
        func onOpenFilePicker(requestId: String)
        func onOpenSystemPrint(requestId: String, jobName: String)
        func onShareDocument(requestId: String, filename: String, data: Data)
    }

    public weak var delegate: BridgeDelegate?
    public weak var webView: WKWebView?

    public init(delegate: BridgeDelegate? = nil, webView: WKWebView? = nil) {
        self.delegate = delegate
        self.webView = webView
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let currentUrl = message.webView?.url
        guard ZamorinSecurityConfig.isAllowedOrigin(url: currentUrl) else {
            respond(requestId: "unknown", success: false, result: nil, errorCode: "UNAUTHORIZED_ORIGIN", errorMessage: "Origin is not permitted to access Zamorin native bridge.")
            return
        }

        guard let body = message.body as? [String: Any] else {
            respond(requestId: "unknown", success: false, result: nil, errorCode: "MALFORMED_MESSAGE", errorMessage: "Message body must be a dictionary.")
            return
        }

        let requestId = body["requestId"] as? String ?? "req_\(Date().timeIntervalSince1970)"
        let action = (body["action"] as? String)?.uppercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let payload = body["payload"] as? [String: Any] ?? [:]

        switch action {
        case "GET_DEVICE_CAPABILITIES", "GET_STORAGE_CAPABILITY":
            let dir = ZamorinMacStorageManager.shared.getAuthorizedDirectory()?.path
            let res: [String: Any] = [
                "platform": "MACOS",
                "isNative": true,
                "canSaveFile": true,
                "canChooseDirectory": true,
                "canPrint": true,
                "canTakePhoto": false,
                "canChoosePhoto": true,
                "canChooseFile": true,
                "canShare": true,
                "currentExportDirectory": dir ?? "",
                "destinationDisplay": dir ?? "Not Configured"
            ]
            respond(requestId: requestId, success: true, result: res)

        case "SELECT_EXPORT_DIRECTORY", "CHANGE_EXPORT_DESTINATION":
            delegate?.onRequestDirectoryPicker(requestId: requestId)

        case "SAVE_DOCUMENT":
            guard let base64Str = payload["base64Data"] as? String,
                  let data = Data(base64Encoded: base64Str) else {
                respond(requestId: requestId, success: false, result: nil, errorCode: "INVALID_BASE64_DATA", errorMessage: "Document data could not be base64 decoded.")
                return
            }
            let filename = payload["filename"] as? String ?? "zamorin_export"
            let subfolder = payload["subfolder"] as? String ?? "ZAMORIN ERP/Exports"

            let writeRes = ZamorinMacStorageManager.shared.writeDocument(subfolder: subfolder, filename: filename, data: data)
            if writeRes.success {
                let res: [String: Any] = [
                    "filePath": writeRes.filePath ?? "",
                    "filename": writeRes.filename,
                    "bytesWritten": writeRes.bytesWritten
                ]
                respond(requestId: requestId, success: true, result: res)
            } else {
                respond(requestId: requestId, success: false, result: nil, errorCode: writeRes.errorCode ?? "WRITE_FAILED", errorMessage: writeRes.errorMessage)
            }

        case "PRINT_DOCUMENT", "OPEN_SYSTEM_PRINT":
            let jobName = payload["jobName"] as? String ?? "Zamorin_Document"
            delegate?.onOpenSystemPrint(requestId: requestId, jobName: jobName)

        case "CHOOSE_FILE", "SELECT_FILE":
            delegate?.onOpenFilePicker(requestId: requestId)

        case "SHARE_DOCUMENT":
            let filename = payload["filename"] as? String ?? "share_document"
            let base64Str = payload["base64Data"] as? String ?? ""
            guard let data = Data(base64Encoded: base64Str) else {
                respond(requestId: requestId, success: false, result: nil, errorCode: "INVALID_BASE64_DATA", errorMessage: "Data decoding failed.")
                return
            }
            delegate?.onShareDocument(requestId: requestId, filename: filename, data: data)

        default:
            respond(requestId: requestId, success: false, result: nil, errorCode: "UNKNOWN_NATIVE_ACTION", errorMessage: "Action '\(action)' is not supported on macOS.")
        }
    }

    public func respond(
        requestId: String,
        success: Bool,
        result: [String: Any]?,
        errorCode: String? = nil,
        errorMessage: String? = nil
    ) {
        var responseDict: [String: Any] = [
            "requestId": requestId,
            "success": success
        ]
        if let result = result { responseDict["result"] = result }
        if let errorCode = errorCode { responseDict["errorCode"] = errorCode }
        if let errorMessage = errorMessage { responseDict["errorMessage"] = errorMessage }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: responseDict),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return
        }

        let js = "window.postMessage(\(jsonString), '*');"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}
