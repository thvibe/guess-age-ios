import Foundation

/// Pure logic for building the four multiple-choice age options.
///
/// Kept free of UI and randomness sources so it is deterministic under test:
/// callers can pass a seeded `RandomNumberGenerator`.
enum AgeOptionGenerator {

    /// Lowest age the game will ever show as an option.
    static let minAge = 1
    /// Highest age the game will ever show as an option.
    static let maxAge = 99

    /// The result of generating a question's options.
    struct Options: Equatable {
        /// Exactly four distinct ages, already shuffled for display.
        let values: [Int]
        /// Index into `values` of the correct (true) age.
        let correctIndex: Int

        var correctValue: Int { values[correctIndex] }
    }

    /// Build four options for a photo whose true age is `trueAge`.
    ///
    /// Guarantees: exactly 4 values, all distinct, all within [minAge, maxAge],
    /// the true age is present, and the distractors sit plausibly near the
    /// truth (a wider window for older subjects, where a one-year miss matters
    /// less perceptually).
    static func makeOptions<G: RandomNumberGenerator>(
        trueAge: Int,
        using rng: inout G
    ) -> Options {
        let truth = clamp(trueAge)

        // Spread scales gently with age: tight for kids, looser for adults.
        let spread = max(3, min(12, 3 + truth / 10))

        var pool = Set<Int>()
        pool.insert(truth)

        // Collect candidate distractors within the window, excluding the truth.
        var candidates: [Int] = []
        for delta in 1...spread {
            let lower = truth - delta
            let upper = truth + delta
            if lower >= minAge { candidates.append(lower) }
            if upper <= maxAge { candidates.append(upper) }
        }
        candidates.shuffle(using: &rng)

        for c in candidates where pool.count < 4 {
            pool.insert(c)
        }

        // Fallback near the [minAge, maxAge] edges where the window is thin:
        // widen outward until we have four distinct values.
        var extra = spread + 1
        while pool.count < 4 && extra < (maxAge - minAge) {
            for c in [truth - extra, truth + extra] where pool.count < 4 {
                if c >= minAge && c <= maxAge { pool.insert(c) }
            }
            extra += 1
        }

        var values = Array(pool)
        values.shuffle(using: &rng)
        let correctIndex = values.firstIndex(of: truth) ?? 0
        return Options(values: values, correctIndex: correctIndex)
    }

    /// Convenience for production code using the system RNG.
    static func makeOptions(trueAge: Int) -> Options {
        var rng = SystemRandomNumberGenerator()
        return makeOptions(trueAge: trueAge, using: &rng)
    }

    static func clamp(_ age: Int) -> Int {
        min(max(age, minAge), maxAge)
    }
}
