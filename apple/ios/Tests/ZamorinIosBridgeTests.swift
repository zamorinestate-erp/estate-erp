import XCTest
@testable import ZamorinCafeERP

/// ZAMORIN CAFÉ ERP — iOS CLIENT SECURITY & UNIVERSAL LINK UNIT TESTS
final class ZamorinIosBridgeTests: XCTestCase {

    func testProductionOriginsAllowed() {
        XCTAssertTrue(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "https://zamorin-cafe-erp.vercel.app")))
        XCTAssertTrue(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "https://zamorin.app")))
        XCTAssertTrue(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "https://zamorin-cafe-erp-backend.onrender.com")))
    }

    func testDisallowedOriginsRejected() {
        XCTAssertFalse(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "http://zamorin-cafe-erp.vercel.app")))
        XCTAssertFalse(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "https://malicious.com")))
        XCTAssertFalse(ZamorinSecurityConfig.isAllowedOrigin(url: URL(string: "file:///etc/passwd")))
        XCTAssertFalse(ZamorinSecurityConfig.isAllowedOrigin(url: nil))
    }

    func testValidCafeUniversalLink() {
        let ref1 = ZamorinSecurityConfig.parseCafeLoginReference(url: URL(string: "https://zamorin-cafe-erp.vercel.app/cafe/CB5A84F8/login"))
        XCTAssertEqual(ref1, "CB5A84F8")

        let ref2 = ZamorinSecurityConfig.parseCafeLoginReference(url: URL(string: "https://zamorin.app/cafe/CAFE_KZD_01/login"))
        XCTAssertEqual(ref2, "CAFE_KZD_01")
    }

    func testInvalidOrTamperedUniversalLink() {
        XCTAssertNil(ZamorinSecurityConfig.parseCafeLoginReference(url: URL(string: "https://untrusted.com/cafe/CB5A84F8/login")))
        XCTAssertNil(ZamorinSecurityConfig.parseCafeLoginReference(url: URL(string: "https://zamorin-cafe-erp.vercel.app/cafe/../../etc/passwd/login")))
        XCTAssertNil(ZamorinSecurityConfig.parseCafeLoginReference(url: URL(string: "https://zamorin-cafe-erp.vercel.app/cafe/CB5A84F8")))
    }
}
