import Foundation

/// Uploads a completed session to the server via multipart/form-data POST.
enum Uploader {

    static func upload(session: Session, data: Data, to baseURL: URL) async throws {
        let url = baseURL.appendingPathComponent("sessions")
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = makeBody(sessionData: data, boundary: boundary)

        let maxAttempts = 3
        var lastError: Error?
        for attempt in 1...maxAttempts {
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    print("[uploader] session \(session.id) uploaded on attempt \(attempt)")
                    return
                }
            } catch {
                lastError = error
                print("[uploader] attempt \(attempt) failed: \(error)")
                if attempt < maxAttempts {
                    try? await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(attempt))) * 1_000_000_000)
                }
            }
        }
        throw lastError ?? URLError(.unknown)
    }

    // MARK: - Multipart body

    private static func makeBody(sessionData: Data, boundary: String) -> Data {
        var body = Data()

        func append(_ string: String) {
            body.append(Data(string.utf8))
        }

        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"session\"; filename=\"session.json\"\r\n")
        append("Content-Type: application/json\r\n\r\n")
        body.append(sessionData)
        append("\r\n")
        append("--\(boundary)--\r\n")

        return body
    }
}
