import Foundation
import WebKit

/// ZAMORIN CAFÉ ERP — APPLE iOS NATIVE MESSAGE BRIDGE
/// Implements Section 4 & 24 WKScriptMessageHandler protocol with origin gating.
public class ZamorinNativeBridge: NSObject, WKScriptMessageHandler {

    public protocol BridgeDelegate: AnyObject {
        func onRequestDirectoryPicker(requestId: String)
        func onTakePhoto(requestId: String)
        func onChoosePhoto(requestId: String)
        func onChooseFile(requestId: String)
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
        // Origin Verification
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
            let dir = ZamorinDocumentManager.shared.getSecurityScopedDirectory()?.path
            let res: [String: Any] = [
                "platform": "IOS",
                "isNative": true,
                "canSaveFile": true,
                "canChooseDirectory": false,
                "canPrint": true,
                "canTakePhoto": true,
                "canChoosePhoto": true,
                "canChooseFile": true,
                "canShare": true,
                "currentExportDirectory": dir ?? "",
                "destinationDisplay": dir ?? "Security-Scoped Container"
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

            let writeRes = ZamorinDocumentManager.shared.writeDocument(subfolder: subfolder, filename: filename, data: data)
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

        case "TAKE_PHOTO":
            delegate?.onTakePhoto(requestId: requestId)

        case "CHOOSE_PHOTO", "SELECT_PHOTO":
            delegate?.onChoosePhoto(requestId: requestId)

        case "CHOOSE_FILE", "SELECT_FILE":
            delegate?.onChooseFile(requestId: requestId)

        case "SHARE_DOCUMENT":
            let filename = payload["filename"] as? String ?? "share_document"
            let base64Str = payload["base64Data"] as? String ?? ""
            guard let data = Data(base64Encoded: base64Str) else {
                respond(requestId: requestId, success: false, result: nil, errorCode: "INVALID_BASE64_DATA", errorMessage: "Data decoding failed.")
                return
            }
            delegate?.onShareDocument(requestId: requestId, filename: filename, data: data)

        default:
            respond(requestId: requestId, success: false, result: nil, errorCode: "UNKNOWN_NATIVE_ACTION", errorMessage: "Action '\(action)' is not supported on iOS.")
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
