import Foundation
import SwiftUI

/// Drives the endless solo game: maintains a shuffled queue of photos, builds
/// the four options per round, tracks score/streak, and reveals the answer.
@MainActor
final class GameViewModel: ObservableObject {

    // MARK: Round state

    /// The photo currently being guessed.
    @Published private(set) var current: AgePhoto?
    /// The four options for the current photo.
    @Published private(set) var options: AgeOptionGenerator.Options?
    /// The option the player tapped, if any (drives reveal styling).
    @Published private(set) var selectedIndex: Int?
    /// True once the player has answered the current photo.
    @Published private(set) var hasAnswered = false

    // MARK: Score

    @Published private(set) var score = 0
    @Published private(set) var rounds = 0
    @Published private(set) var correctCount = 0
    @Published private(set) var streak = 0
    @Published private(set) var bestStreak = 0

    var accuracy: Double {
        rounds == 0 ? 0 : Double(correctCount) / Double(rounds)
    }

    var isCorrect: Bool {
        guard let selectedIndex, let options else { return false }
        return selectedIndex == options.correctIndex
    }

    private let store: DataStore
    private var queue: [AgePhoto] = []

    init(store: DataStore) {
        self.store = store
        start()
    }

    /// (Re)start a fresh game.
    func start() {
        score = 0; rounds = 0; correctCount = 0; streak = 0; bestStreak = 0
        queue = store.photos.shuffled()
        advance()
    }

    /// Register the player's tap. No-op once already answered.
    func select(_ index: Int) {
        guard !hasAnswered, let options, options.values.indices.contains(index) else { return }
        selectedIndex = index
        hasAnswered = true
        rounds += 1
        if index == options.correctIndex {
            correctCount += 1
            streak += 1
            bestStreak = max(bestStreak, streak)
            // Bonus points for sustained streaks keep "just keep playing" rewarding.
            score += 10 + min(streak - 1, 10)
        } else {
            streak = 0
        }
    }

    /// Move to the next photo.
    func advance() {
        refillIfNeeded()
        selectedIndex = nil
        hasAnswered = false
        guard let next = queue.first else {
            current = nil
            options = nil
            return
        }
        queue.removeFirst()
        current = next
        options = AgeOptionGenerator.makeOptions(trueAge: next.age)
    }

    /// Endless loop: when the queue runs low, reshuffle the full known pool
    /// (which may have grown via the streamed manifest) back in.
    private func refillIfNeeded() {
        guard queue.count <= AppConfig.refillThreshold, !store.photos.isEmpty else { return }
        let currentID = current?.id
        var refill = store.photos.shuffled()
        // Avoid showing the same photo twice in a row across the seam.
        if let currentID, refill.first?.id == currentID, refill.count > 1 {
            refill.swapAt(0, 1)
        }
        queue.append(contentsOf: refill)
    }
}
