package com.portfolio.recruitment.service;

import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AtsScoringService {

  private static final Set<String> STOP_WORDS = new HashSet<>(Arrays.asList(
      "the", "and", "for", "with", "that", "this", "from", "into", "your", "have",
      "been", "will", "should", "about", "over", "under", "their", "there", "them",
      "role", "experience", "skills", "years", "year", "developer", "engineer", "candidate"
  ));

  public static int calculateAtsScore(String jobDescription, String resumeText) {
    if (jobDescription == null || jobDescription.isBlank() || resumeText == null || resumeText.isBlank()) {
      return 0;
    }

    Set<String> jobKeywords = extractKeywords(jobDescription);
    Set<String> resumeKeywords = extractKeywords(resumeText);
    Set<String> overlap = new HashSet<>(jobKeywords);
    overlap.retainAll(resumeKeywords);

    int keywordScore = (int) Math.round((overlap.size() * 100.0) / Math.max(1, jobKeywords.size()));

    int experienceBonus = 0;
    if (resumeText.toLowerCase().contains("years") || resumeText.toLowerCase().contains("yr") || resumeText.toLowerCase().contains("experience")) {
      experienceBonus = 10;
    }

    int total = Math.min(100, keywordScore + experienceBonus);
    if (jobKeywords.size() <= 4 && overlap.size() <= 1) {
      return Math.max(0, total - 20);
    }
    return total;
  }

  private static Set<String> extractKeywords(String input) {
    return Arrays.stream(input.toLowerCase().replaceAll("[^a-z0-9\\s]", " ")
            .split("\\s+"))
        .map(String::trim)
        .filter(token -> token.length() > 2)
        .filter(token -> !STOP_WORDS.contains(token))
        .collect(Collectors.toCollection(HashSet::new));
  }
}
