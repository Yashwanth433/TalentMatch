package com.portfolio.recruitment.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "jobs")
public class Job {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(length = 36)
  private String id;

  @NotBlank
  @Column(nullable = false)
  private String title;

  @NotBlank
  @Column(nullable = false, length = 4000)
  private String description;

  private String companyName;
  private String department;
  private String location;
  private String employmentType;
  private Integer minExperienceYears;
  private String educationRequirements;
  private String contactEmail;
  private String contactPhone;
  @Column(nullable = false)
  private String status = "OPEN";

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "job_required_skills", joinColumns = @JoinColumn(name = "job_id"))
  @Column(name = "required_skills")
  private List<String> requiredSkills = new ArrayList<>();

  private Instant createdAt = Instant.now();

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }

  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }

  public String getCompanyName() { return companyName; }
  public void setCompanyName(String companyName) { this.companyName = companyName; }

  public String getDepartment() { return department; }
  public void setDepartment(String department) { this.department = department; }

  public String getLocation() { return location; }
  public void setLocation(String location) { this.location = location; }

  public String getEmploymentType() { return employmentType; }
  public void setEmploymentType(String employmentType) { this.employmentType = employmentType; }

  public Integer getMinExperienceYears() { return minExperienceYears; }
  public void setMinExperienceYears(Integer minExperienceYears) { this.minExperienceYears = minExperienceYears; }

  public String getEducationRequirements() { return educationRequirements; }
  public void setEducationRequirements(String educationRequirements) { this.educationRequirements = educationRequirements; }

  public String getContactEmail() { return contactEmail; }
  public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }

  public String getContactPhone() { return contactPhone; }
  public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }

  public List<String> getRequiredSkills() { return requiredSkills; }
  public void setRequiredSkills(List<String> requiredSkills) { this.requiredSkills = requiredSkills; }

  public Instant getCreatedAt() { return createdAt; }
}
