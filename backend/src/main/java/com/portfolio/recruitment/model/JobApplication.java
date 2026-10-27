package com.portfolio.recruitment.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(name = "applications", uniqueConstraints = {
    @UniqueConstraint(name = "candidate_job_unique", columnNames = {"candidate_id", "job_id"})
})
public class JobApplication {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  @Column(length = 36)
  private String id;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "job_id", nullable = false)
  private Job job;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "candidate_id", nullable = false)
  private Candidate candidate;

  @Column(length = 12000)
  private String coverLetter;

  @Column(length = 20000)
  private String resumeText;

  private String resumeFileName;
  private String phone;
  private String education;
  private String experienceSummary;
  private String skills;

  private Integer atsScore;

  @Column(length = 12000)
  private String aiSummary;

  private String status = "PENDING";

  private Instant createdAt = Instant.now();

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public Job getJob() { return job; }
  public void setJob(Job job) { this.job = job; }

  public Candidate getCandidate() { return candidate; }
  public void setCandidate(Candidate candidate) { this.candidate = candidate; }

  public String getJobId() { return job == null ? null : job.getId(); }
  public String getCandidateId() { return candidate == null ? null : candidate.getId(); }

  public String getCoverLetter() { return coverLetter; }
  public void setCoverLetter(String coverLetter) { this.coverLetter = coverLetter; }

  public String getResumeText() { return resumeText; }
  public void setResumeText(String resumeText) { this.resumeText = resumeText; }

  public String getResumeFileName() { return resumeFileName; }
  public void setResumeFileName(String resumeFileName) { this.resumeFileName = resumeFileName; }

  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone; }

  public String getEducation() { return education; }
  public void setEducation(String education) { this.education = education; }

  public String getExperienceSummary() { return experienceSummary; }
  public void setExperienceSummary(String experienceSummary) { this.experienceSummary = experienceSummary; }

  public String getSkills() { return skills; }
  public void setSkills(String skills) { this.skills = skills; }

  public Integer getAtsScore() { return atsScore; }
  public void setAtsScore(Integer atsScore) { this.atsScore = atsScore; }

  public String getAiSummary() { return aiSummary; }
  public void setAiSummary(String aiSummary) { this.aiSummary = aiSummary; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }

  public Instant getCreatedAt() { return createdAt; }
}
