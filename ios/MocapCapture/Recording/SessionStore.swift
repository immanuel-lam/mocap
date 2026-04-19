import Foundation

/// Saves and lists sessions in Documents/sessions/<id>/session.json
enum SessionStore {

    static var sessionsURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("sessions", isDirectory: true)
    }

    static func save(session: Session, data: Data) throws -> URL {
        let dir = sessionsURL.appendingPathComponent(session.id, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent("session.json")
        try data.write(to: url)
        return url
    }

    static func listIDs() -> [String] {
        (try? FileManager.default.contentsOfDirectory(atPath: sessionsURL.path)) ?? []
    }

    static func load(id: String) throws -> (Session, Data) {
        let url = sessionsURL.appendingPathComponent(id).appendingPathComponent("session.json")
        let data = try Data(contentsOf: url)
        let session = try JSONDecoder().decode(Session.self, from: data)
        return (session, data)
    }

    static func delete(id: String) throws {
        let dir = sessionsURL.appendingPathComponent(id, isDirectory: true)
        try FileManager.default.removeItem(at: dir)
    }
}
