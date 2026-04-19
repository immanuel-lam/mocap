import Foundation

enum SessionEncoder {
    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()

    static func encode(_ session: Session) throws -> Data {
        try encoder.encode(session)
    }
}
