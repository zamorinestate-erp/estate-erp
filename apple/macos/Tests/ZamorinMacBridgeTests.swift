import XCTest
@testable import ZamorinCafeERP

/// ZAMORIN CAFÉ ERP — macOS CLIENT SECURITY & UNIVERSAL LINK UNIT TESTS
final class ZamorinMacBridgeTests: XCTestCase {

    func testMacProductionOriginsAllowed() {
        XCTAssertTrue(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "https://zamorin-cafe-erp.vercel.app")))
        XCTAssertTrue(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "https://zamorin.app")))
        XCTAssertTrue(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "https://zamorin-cafe-erp-backend.onrender.com")))
    }

    func testMacDisallowedOriginsRejected() {
        XCTAssertFalse(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "http://zamorin-cafe-erp.vercel.app")))
        XCTAssertFalse(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "https://phishing.com")))
        XCTAssertFalse(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "file:///System/Library")))
    }

    func testMacUniversalLinkParsing() {
        let ref = ZamorinSecurityConfig.parseCafeLoginReference(url: URL(string: "https://zamorin-cafe-erp.vercel.app/cafe/CB5A84F8/login"))
        XCTAssertEqual(ref, "CB5A84F8")
    }

    func testMacTamperedUniversalLinkRejected() {
        XCTAssertNil(ZamorinSecurityConfig.parseCafeLoginReference(url: URL(string: "https://evil.com/cafe/CB5A84F8/login")))
        XCTAssertNil(ZamorinSecurityConfig.parseCafeLoginReference(url: URL(string: "https://zamorin-cafe-erp.vercel.app/cafe/CB5A84F8/admin")))
    }
}
