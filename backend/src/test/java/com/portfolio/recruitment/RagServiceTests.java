package com.portfolio.recruitment;

import com.portfolio.recruitment.service.RagService;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class RagServiceTests {
  @Test void chunksLongTextAndPreservesContent() {
    String input = "Java Spring Boot React ".repeat(100);
    List<String> chunks = RagService.chunk(input, 200, 30);
    assertTrue(chunks.size() > 1);
    assertTrue(chunks.stream().allMatch(s -> !s.isBlank() && s.length() <= 200));
  }
  @Test void cosineSimilarityFindsAlignedVectors() {
    assertEquals(1.0, RagService.cosine(List.of(1.0, 0.0), List.of(1.0, 0.0)), 0.0001);
    assertEquals(0.0, RagService.cosine(List.of(1.0, 0.0), List.of(0.0, 1.0)), 0.0001);
  }
}
