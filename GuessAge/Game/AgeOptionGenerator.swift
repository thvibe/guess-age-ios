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
    /// Minimum spacing between any two options, so choices are never
    /// near-duplicates (e.g. never "80" next to "82").
    static let minOptionGap = 8

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
    /// Guarantees: exactly 4 values, all within [minAge, maxAge], the true age
    /// present, and every pair of options at least `minOptionGap` years apart.
    /// The distractors grow outward from the truth (alternating sides) so they
    /// stay plausibly near it while remaining clearly distinguishable.
    static func makeOptions<G: RandomNumberGenerator>(
        trueAge: Int,
        using rng: inout G
    ) -> Options {
        let truth = clamp(trueAge)
        var chosen = [truth]
        var low = truth, high = truth
        var preferHigh = Bool.random(using: &rng)

        while chosen.count < 4 {
            // A gap that's always >= minOptionGap, with a little variety so the
            // options don't form an obvious arithmetic sequence.
            let step = minOptionGap + Int.random(in: 0...6, using: &rng)
            let canHigh = high + step <= maxAge
            let canLow = low - step >= minAge

            let useHigh: Bool
            if canHigh && canLow {
                useHigh = preferHigh
                preferHigh.toggle()
            } else if canHigh {
                useHigh = true
            } else if canLow {
                useHigh = false
            } else {
                break // no room on either side (only in pathological ranges)
            }

            if useHigh {
                high += step
                chosen.append(high)
            } else {
                low -= step
                chosen.append(low)
            }
        }

        // Safety net for impossibly tight ranges: fill with distinct values.
        // Not reached for the real [1, 99] range with minOptionGap 8.
        if chosen.count < 4 {
            var v = minAge
            while chosen.count < 4 && v <= maxAge {
                if !chosen.contains(v) { chosen.append(v) }
                v += 1
            }
        }

        chosen.shuffle(using: &rng)
        let correctIndex = chosen.firstIndex(of: truth) ?? 0
        return Options(values: chosen, correctIndex: correctIndex)
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
