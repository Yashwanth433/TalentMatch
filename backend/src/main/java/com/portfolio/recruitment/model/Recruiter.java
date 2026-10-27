package com.portfolio.recruitment.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

@Entity
@Table(name = "recruiters")
public class Recruiter {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(length = 36)
  private String id;

  @NotBlank
  @Column(nullable = false, unique = true)
  private String username;

  @NotBlank
  @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
  @Column(nullable = false)
  private String password;

  @NotBlank
  private String fullName;

  @NotBlank
  private String companyName;

  private String email;
  private String phone;

  private Instant createdAt = Instant.now();

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public String getUsername() { return username; }
  public void setUsername(String username) { this.username = username; }

  public String getPassword() { return password; }
  public void setPassword(String password) { this.password = password; }

  public String getFullName() { return fullName; }
  public void setFullName(String fullName) { this.fullName = fullName; }

  public String getCompanyName() { return companyName; }
  public void setCompanyName(String companyName) { this.companyName = companyName; }

  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }

  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone; }

  public Instant getCreatedAt() { return createdAt; }
}
