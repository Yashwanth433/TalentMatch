package com.portfolio.recruitment.controller;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<Map<String,String>> state(IllegalStateException ex) {
    return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error",ex.getMessage()));
  }
  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String,String>> status(ResponseStatusException ex) {
    return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error",ex.getReason()==null?"Request failed":ex.getReason()));
  }
}
