import SwiftUI

/// Landing menu: Play, How to play, and Photo credits.
struct RootView: View {
    @EnvironmentObject private var store: DataStore
    @State private var showHowTo = false

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
                    NavigationLink {
                        GameView(store: store)
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

                Text("\(store.photos.count) photos loaded")
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
                rule("person.crop.circle", "Each round shows an AI-generated person — a synthetic face, no real identity.")
                rule("4.square", "Tap which of the four ages is correct.")
                rule("wand.and.stars", "Every face is generated at a target age. Your job is to guess how old it looks.")
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
