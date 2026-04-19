import SwiftUI

struct SettingsView: View {
    @AppStorage("serverURL") private var serverURL = ""
    @StateObject private var discovery = Discovery()

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("http://192.168.x.x:3000", text: $serverURL)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .autocapitalization(.none)
                }

                Section("Auto-Discover (Bonjour)") {
                    if discovery.servers.isEmpty {
                        Text("Searching…")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(discovery.servers) { server in
                            Button {
                                serverURL = "http://\(server.host):\(server.port)"
                            } label: {
                                HStack {
                                    Text(server.name)
                                    Spacer()
                                    if serverURL == "http://\(server.host):\(server.port)" {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.tint)
                                    }
                                }
                            }
                            .foregroundStyle(.primary)
                        }
                    }
                }
            }
            .navigationTitle("Settings")
        }
        .onAppear { discovery.start() }
        .onDisappear { discovery.stop() }
    }
}
