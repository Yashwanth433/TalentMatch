package com.portfolio.recruitment.service;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;

/** Small, transparent RAG pipeline for a portfolio demo. Vectors are computed per request and not persisted. */
@Service
public class RagService {
  private final GeminiService gemini;
  public RagService(GeminiService gemini) { this.gemini = gemini; }

  public Map<String,Object> analyze(String jobDescription, String resumeText) {
    List<String> jobChunks = chunk(jobDescription, 650, 90);
    List<String> resumeChunks = chunk(resumeText, 650, 90);
    if (jobChunks.isEmpty() || resumeChunks.isEmpty()) throw new IllegalArgumentException("Add both a job description and resume text.");

    List<VectorChunk> resumeVectors = new ArrayList<>();
    for (int i = 0; i < resumeChunks.size(); i++) resumeVectors.add(new VectorChunk("Resume section " + (i + 1), resumeChunks.get(i), gemini.embed(resumeChunks.get(i))));

    // Embed job requirements, then retrieve the most relevant resume passages for each requirement.
    List<VectorChunk> jobVectors = new ArrayList<>();
    for (int i = 0; i < jobChunks.size(); i++) jobVectors.add(new VectorChunk("Job requirement " + (i + 1), jobChunks.get(i), gemini.embed(jobChunks.get(i))));

    Map<String,VectorChunk> retrieved = new LinkedHashMap<>();
    for (VectorChunk requirement : jobVectors) {
      resumeVectors.stream().map(candidate -> new ScoredChunk(candidate, cosine(requirement.vector(), candidate.vector())))
        .sorted(Comparator.comparingDouble(ScoredChunk::score).reversed()).limit(2)
        .forEach(scored -> retrieved.putIfAbsent(scored.chunk().text(), scored.chunk()));
    }
    List<Map<String,Object>> evidence = new ArrayList<>();
    for (VectorChunk chunk : retrieved.values().stream().limit(6).toList()) {
      evidence.add(Map.of("source", chunk.label(), "text", chunk.text()));
    }
    String context = evidence.stream().map(e -> "[" + e.get("source") + "] " + e.get("text")).collect(Collectors.joining("\n\n"));
    String prompt = "You are an evidence-grounded career assistant. Compare the job requirements with the retrieved resume excerpts below. Use only the provided job description and excerpts. Do not infer protected characteristics, make an automatic hiring/rejection decision, or create a numeric candidate score. Clearly distinguish evidence from missing or unclear information. Return ONLY valid JSON with keys matching_skills (array of supported skills), missing_or_unclear_skills (array of important requirements not supported by the excerpts), evidence (array of objects with requirement and resume_evidence), recommendations (array of practical resume improvements or skills to develop, without suggesting invented experience), and summary (exactly 2 or 3 short paragraphs describing the candidate's relevant professional background, what the resume supports, and the alignment and gaps for this role).\nJOB DESCRIPTION:\n" + jobDescription + "\n\nRETRIEVED RESUME EXCERPTS:\n" + context;
    String analysis = gemini.generate(prompt);
    return Map.of("analysis", analysis, "retrievedEvidence", evidence, "ragMode", "Gemini embeddings + cosine similarity retrieval", "notice", "AI output may be inaccurate. Review the original resume and job description; do not use this analysis as the sole basis for employment decisions.");
  }

  public static List<String> chunk(String input, int maxChars, int overlap) {
    if (input == null || input.isBlank()) return List.of();
    String normalized = input.replaceAll("\\s+", " ").trim();
    List<String> chunks = new ArrayList<>();
    int start = 0;
    while (start < normalized.length()) {
      int end = Math.min(start + maxChars, normalized.length());
      if (end < normalized.length()) {
        int boundary = normalized.lastIndexOf(' ', end);
        if (boundary > start + maxChars / 2) end = boundary;
      }
      chunks.add(normalized.substring(start, end).trim());
      if (end >= normalized.length()) break;
      start = Math.max(end - overlap, start + 1);
    }
    return chunks;
  }

  public static double cosine(List<Double> a, List<Double> b) {
    if (a.size() != b.size() || a.isEmpty()) return 0;
    double dot = 0, aa = 0, bb = 0;
    for (int i = 0; i < a.size(); i++) { dot += a.get(i) * b.get(i); aa += a.get(i) * a.get(i); bb += b.get(i) * b.get(i); }
    return aa == 0 || bb == 0 ? 0 : dot / (Math.sqrt(aa) * Math.sqrt(bb));
  }
  private record VectorChunk(String label, String text, List<Double> vector) {}
  private record ScoredChunk(VectorChunk chunk, double score) {}
}
