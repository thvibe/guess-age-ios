import SwiftUI

/// The main game screen: endless rounds of "guess the age".
struct GameView: View {
    @StateObject private var game: GameViewModel

    /// Owns its view model for the lifetime of the pushed screen, so an
    /// unrelated `store` update can't recreate it and reset the score.
    init(store: DataStore, mode: FaceStyle) {
        _game = StateObject(wrappedValue: GameViewModel(store: store, mode: mode))
    }

    var body: some View {
        VStack(spacing: 16) {
            scoreBar

            if let photo = game.current, let options = game.options {
                PhotoCardView(photo: photo, style: game.mode)
                    .frame(maxWidth: .infinity)
                    .frame(maxHeight: .infinity)
                    .id(photo.id) // force a fresh transition per photo

                reveal(for: photo)

                optionGrid(options)

                nextButton
                    .opacity(game.hasAnswered ? 1 : 0)
                    .disabled(!game.hasAnswered)
            } else {
                Spacer()
                ContentUnavailableLikeView()
                Spacer()
            }
        }
        .padding(.horizontal)
        .padding(.bottom, 12)
        .navigationTitle("Guess the Age")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    withAnimation { game.start() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("Restart")
            }
        }
    }

    // MARK: Pieces

    private var scoreBar: some View {
        HStack {
            stat(title: "Score", value: "\(game.score)")
            Spacer()
            stat(title: "Streak", value: "\(game.streak)")
            Spacer()
            stat(title: "Best", value: "\(game.bestStreak)")
            Spacer()
            stat(title: "Accuracy", value: "\(Int((game.accuracy * 100).rounded()))%")
        }
        .padding(.top, 4)
    }

    private func stat(title: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.headline.monospacedDigit())
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private func optionGrid(_ options: AgeOptionGenerator.Options) -> some View {
        let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        return LazyVGrid(columns: columns, spacing: 12) {
            ForEach(Array(options.values.enumerated()), id: \.offset) { index, age in
                AnswerButton(age: age, state: state(for: index, options: options)) {
                    game.select(index)
                }
            }
        }
    }

    private func state(for index: Int, options: AgeOptionGenerator.Options) -> AnswerButton.State {
        guard game.hasAnswered else { return .idle }
        if index == options.correctIndex { return .correct }
        if index == game.selectedIndex { return .wrongSelected }
        return .dimmed
    }

    @ViewBuilder
    private func reveal(for photo: AgePhoto) -> some View {
        if game.hasAnswered {
            VStack(spacing: 4) {
                Text(game.isCorrect ? "Correct!" : "Actual age: \(photo.age)")
                    .font(.title3.bold())
                    .foregroundStyle(game.isCorrect ? .green : .red)
                if let name = photo.name {
                    Text(name)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let attribution = photo.attribution, attribution.requiresAttribution {
                    Text(creditLine(attribution))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
            .transition(.opacity)
        } else {
            Text("How old is this person?")
                .font(.headline)
                .foregroundStyle(.secondary)
        }
    }

    private func creditLine(_ a: Attribution) -> String {
        "Photo: \(a.author) · \(a.license)"
    }

    private var nextButton: some View {
        Button {
            withAnimation { game.advance() }
        } label: {
            Text("Next")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// Tiny fallback shown if there are somehow no photos to play.
private struct ContentUnavailableLikeView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("No photos available")
                .font(.headline)
            Text("Generate a dataset with tools/build_dataset.py.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}
