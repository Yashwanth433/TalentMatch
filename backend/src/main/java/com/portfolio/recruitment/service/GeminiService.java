package com.portfolio.recruitment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.*;

@Service
public class GeminiService {
  @Value("${gemini.api-key}") private String apiKey;
  @Value("${gemini.model}") private String model;
  @Value("${gemini.base-url}") private String baseUrl;
  private final RestClient client = RestClient.create();
  private final ObjectMapper mapper = new ObjectMapper();

  public String generate(String prompt) {
    if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("Gemini API key is not loaded. Add GEMINI_API_KEY to recruitment-platform/.env or set it in the backend environment, then restart the backend.");
    try {
      Map<String,Object> body = Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))));
      String response = client.post().uri(baseUrl + "/" + model + ":generateContent?key=" + apiKey)
        .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
      JsonNode root = mapper.readTree(response);
      JsonNode text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
      if (text.isMissingNode() || text.asText().isBlank()) throw new IllegalStateException("Gemini returned no text.");
      return text.asText();
    } catch (org.springframework.web.client.RestClientResponseException e) {
      throw new IllegalStateException("Gemini API request failed (" + e.getStatusCode().value() + "): " + providerMessage(e), e);
    } catch (Exception e) {
      if (e instanceof IllegalStateException) throw (IllegalStateException)e;
      throw new IllegalStateException("Unable to process Gemini response.", e);
    }
  }

  /** Creates a semantic embedding using Google's embedding endpoint. */
  public List<Double> embed(String text) {
    if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("Gemini API key is not loaded. Add GEMINI_API_KEY to recruitment-platform/.env or set it in the backend environment, then restart the backend.");
    try {
      Map<String,Object> body = Map.of("content", Map.of("parts", List.of(Map.of("text", text))), "outputDimensionality", 768);
      String response = client.post()
        .uri(baseUrl + "/gemini-embedding-001:embedContent?key=" + apiKey)
        .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
      JsonNode values = mapper.readTree(response).path("embedding").path("values");
      if (!values.isArray() || values.isEmpty()) throw new IllegalStateException("Embedding service returned no vector.");
      List<Double> vector = new ArrayList<>();
      values.forEach(v -> vector.add(v.asDouble()));
      return vector;
    } catch (org.springframework.web.client.RestClientResponseException e) {
      throw new IllegalStateException("Gemini embedding request failed (" + e.getStatusCode().value() + "): " + providerMessage(e), e);
    } catch (Exception e) {
      if (e instanceof IllegalStateException) throw (IllegalStateException)e;
      throw new IllegalStateException("Unable to create document embeddings.", e);
    }
  }

  private String providerMessage(org.springframework.web.client.RestClientResponseException exception) {
    String responseBody = exception.getResponseBodyAsString();
    try {
      String message = mapper.readTree(responseBody).path("error").path("message").asText("");
      if (!message.isBlank()) {
        return apiKey == null || apiKey.isBlank() ? message : message.replace(apiKey, "[redacted]");
      }
    } catch (com.fasterxml.jackson.core.JsonProcessingException exceptionParsingError) {
      return "Google returned an unreadable error response. Check API key, quota, and model access.";
    }
    return "Check API key, quota, and model access.";
  }
}
