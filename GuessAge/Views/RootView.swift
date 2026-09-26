import SwiftUI

/// Landing menu: Play, How to play, and Photo credits.
struct RootView: View {
    @EnvironmentObject private var store: DataStore
    @State private var showHowTo = false
    @AppStorage("faceStyle") private var faceStyleRaw = FaceStyle.cartoon.rawValue

    private var faceStyle: FaceStyle { FaceStyle(rawValue: faceStyleRaw) ?? .cartoon }
    private var hasPhotoDataset: Bool {
        store.photos.contains { $0.imageURL != nil || $0.localImageName != nil }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer()

                VStack(spacing: 8) {
                    Image(systemName: "person.fill.questionmark")
                        .font(.system(size: 64))
                        .foregroundStyle(.tint)
                    Text("Guess the Age")
                        .font(.largeTitle.bold())
                    Text("Look at the face. Pick the right age.\nKeep going as long as you like.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                VStack(spacing: 14) {
                    Picker("Image style", selection: $faceStyleRaw) {
                        ForEach(FaceStyle.allCases) { style in
                            Text(style.label).tag(style.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)

                    if faceStyle == .photo && !hasPhotoDataset {
                        Text("No anime images loaded yet — generate them with tools/generate_faces.py, or play Cartoon.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    NavigationLink {
                        GameView(store: store, mode: faceStyle)
                    } label: {
                        menuLabel("Play", systemImage: "play.fill", prominent: true)
                    }

                    Button { showHowTo = true } label: {
                        menuLabel("How to play", systemImage: "questionmark.circle")
                    }

                    NavigationLink {
                        AboutView()
                    } label: {
                        menuLabel("About the images", systemImage: "info.circle")
                    }
                }

                Text(faceStyle == .cartoon ? "Cartoon faces · all ages"
                                           : "\(store.photos.count) photos loaded")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)

                Spacer()
            }
            .padding()
            .buttonStyle(.plain)
            .sheet(isPresented: $showHowTo) { HowToPlayView() }
        }
    }

    private func menuLabel(_ title: String, systemImage: String, prominent: Bool = false) -> some View {
        HStack {
            Image(systemName: systemImage)
            Text(title).font(.headline)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(prominent ? Color.accentColor : Color(.secondarySystemBackground))
        .foregroundStyle(prominent ? Color.white : Color.primary)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct HowToPlayView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                rule("photo.artframe", "Choose your faces: Cartoon (drawn in-app, all ages) or Anime (AI-drawn, adults 18+).")
                rule("4.square", "Each round shows a face — tap which of the four ages is correct.")
                rule("person.crop.circle", "All faces are synthetic — no real people. The correct answer is the age each one was made at.")
                rule("flame", "Build a streak for bonus points. There's no finish line — just keep guessing.")
                Spacer()
            }
            .padding()
            .navigationTitle("How to play")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func rule(_ icon: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.tint)
                .frame(width: 30)
            Text(text)
            Spacer()
        }
    }
}
