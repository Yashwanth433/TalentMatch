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
@Table(name = "candidates")
public class Candidate {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(length = 36)
  private String id;

  @NotBlank
  private String name;

  @NotBlank
  @Column(nullable = false, unique = true)
  private String username;

  @NotBlank
  @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
  @Column(nullable = false)
  private String password;

  private String email;
  private String phone;
  private String skills;
  private String education;
  private String summary;
  private Integer experienceYears;

  @Column(length = 20000)
  private String resumeText;

  private String resumeFileName;

  @Column(length = 12000)
  private String extractedProfile;

  private Instant createdAt = Instant.now();

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public String getUsername() { return username; }
  public void setUsername(String username) { this.username = username; }

  public String getPassword() { return password; }
  public void setPassword(String password) { this.password = password; }

  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }

  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone; }

  public String getSkills() { return skills; }
  public void setSkills(String skills) { this.skills = skills; }

  public String getEducation() { return education; }
  public void setEducation(String education) { this.education = education; }

  public String getSummary() { return summary; }
  public void setSummary(String summary) { this.summary = summary; }

  public Integer getExperienceYears() { return experienceYears; }
  public void setExperienceYears(Integer experienceYears) { this.experienceYears = experienceYears; }

  public String getResumeText() { return resumeText; }
  public void setResumeText(String resumeText) { this.resumeText = resumeText; }

  public String getResumeFileName() { return resumeFileName; }
  public void setResumeFileName(String resumeFileName) { this.resumeFileName = resumeFileName; }

  public String getExtractedProfile() { return extractedProfile; }
  public void setExtractedProfile(String extractedProfile) { this.extractedProfile = extractedProfile; }

  public Instant getCreatedAt() { return createdAt; }
}
