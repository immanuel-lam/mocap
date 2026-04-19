import Foundation
import Network

struct DiscoveredServer: Identifiable, Hashable {
    let id: String      // endpoint description
    let name: String
    let host: String
    let port: UInt16

    var wsURL: URL? {
        URL(string: "ws://\(host):\(port)/ws")
    }
}

/// Browses for _mocap._tcp Bonjour services on the local network.
/// Reads the server's IP from the TXT record key "ip" that the Node server publishes.
@MainActor
final class Discovery: ObservableObject {

    @Published var servers: [DiscoveredServer] = []

    private var browser: NWBrowser?

    func start() {
        let params = NWParameters()
        params.includePeerToPeer = true

        let descriptor = NWBrowser.Descriptor.bonjour(type: "_mocap._tcp", domain: nil)
        browser = NWBrowser(for: descriptor, using: params)

        browser?.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                var found: [DiscoveredServer] = []
                for result in results {
                    if case .service(let name, _, _, _) = result.endpoint {
                        // Read IP from TXT record ("ip" key published by the Node server).
                        // Fall back to attempting name.local if TXT record is absent.
                        var resolvedHost: String = "\(name).local"

                        if case .bonjour(let txt) = result.metadata {
                            for (key, valueStr) in txt.dictionary where key == "ip" {
                                if !valueStr.isEmpty {
                                    resolvedHost = valueStr
                                }
                            }
                        }

                        found.append(DiscoveredServer(
                            id: name,
                            name: name,
                            host: resolvedHost,
                            port: 3000
                        ))
                    }
                }
                servers = found
            }
        }

        browser?.stateUpdateHandler = { state in
            if case .failed(let err) = state {
                print("[discovery] failed:", err)
            }
        }

        browser?.start(queue: .main)
    }

    func stop() {
        browser?.cancel()
        browser = nil
    }
}
