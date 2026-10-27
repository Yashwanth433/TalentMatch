package com.portfolio.recruitment.controller;

import com.portfolio.recruitment.model.*;
import com.portfolio.recruitment.repo.*;
import com.portfolio.recruitment.service.AtsScoringService;
import com.portfolio.recruitment.service.GeminiService;
import com.portfolio.recruitment.service.RagService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import jakarta.validation.Valid;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api")
public class RecruitmentController {
  private final JobRepository jobs;
  private final CandidateRepository candidates;
  private final RecruiterRepository recruiters;
  private final ApplicationRepository applications;
  private final GeminiService gemini;
  private final RagService rag;
  private final AtsScoringService atsScoringService;
  private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
  private final ObjectMapper objectMapper = new ObjectMapper();

  public RecruitmentController(JobRepository jobs,
                              CandidateRepository candidates,
                              RecruiterRepository recruiters,
                              ApplicationRepository applications,
                              GeminiService gemini,
                              RagService rag,
                              AtsScoringService atsScoringService) {
    this.jobs = jobs;
    this.candidates = candidates;
    this.recruiters = recruiters;
    this.applications = applications;
    this.gemini = gemini;
    this.rag = rag;
    this.atsScoringService = atsScoringService;
  }

  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "ok", "service", "recruitment-api");
  }

  @PostMapping("/auth/candidate/register")
  @ResponseStatus(HttpStatus.CREATED)
  public Candidate registerCandidate(@Valid @RequestBody Candidate candidate) {
    if (candidate.getUsername() == null || candidate.getUsername().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username is required");
    }
    if (candidate.getPassword() == null || candidate.getPassword().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password is required");
    }
    if (candidates.findByUsername(candidate.getUsername()).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
    }
    candidate.setId(null);
    candidate.setPassword(passwordEncoder.encode(candidate.getPassword()));
    try {
      return candidates.save(candidate);
    } catch (DataIntegrityViolationException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists", exception);
    }
  }

  @PostMapping("/auth/recruiter/register")
  @ResponseStatus(HttpStatus.CREATED)
  public Recruiter registerRecruiter(@Valid @RequestBody Recruiter recruiter) {
    if (recruiter.getUsername() == null || recruiter.getUsername().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username is required");
    }
    if (recruiter.getPassword() == null || recruiter.getPassword().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password is required");
    }
    if (recruiters.findByUsername(recruiter.getUsername()).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
    }
    recruiter.setId(null);
    recruiter.setPassword(passwordEncoder.encode(recruiter.getPassword()));
    try {
      return recruiters.save(recruiter);
    } catch (DataIntegrityViolationException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists", exception);
    }
  }

  @PutMapping("/recruiters/{id}/profile")
  public Recruiter updateRecruiterProfile(@PathVariable String id, @RequestBody RecruiterProfileRequest request) {
    Recruiter recruiter = recruiters.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter not found"));
    if (request.fullName() == null || request.fullName().isBlank()
        || request.companyName() == null || request.companyName().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name and company name are required.");
    }
    validateLength(request.fullName(), 255, "full name");
    validateLength(request.companyName(), 255, "company name");
    validateLength(request.email(), 255, "email");
    validateLength(request.phone(), 255, "phone");

    String previousCompanyName = recruiter.getCompanyName();
    String previousEmail = recruiter.getEmail();
    String previousPhone = recruiter.getPhone();
    recruiter.setFullName(request.fullName().trim());
    recruiter.setCompanyName(request.companyName().trim());
    recruiter.setEmail(request.email());
    recruiter.setPhone(request.phone());
    recruiters.save(recruiter);

    for (Job job : jobs.findAll()) {
      if (Objects.equals(job.getCompanyName(), previousCompanyName)) {
        job.setCompanyName(recruiter.getCompanyName());
        if (Objects.equals(job.getContactEmail(), previousEmail)) job.setContactEmail(recruiter.getEmail());
        if (Objects.equals(job.getContactPhone(), previousPhone)) job.setContactPhone(recruiter.getPhone());
        jobs.save(job);
      }
    }
    return recruiter;
  }

  @PostMapping("/auth/candidate/login")
  public Map<String, Object> loginCandidate(@RequestBody LoginRequest request) {
    Candidate candidate = candidates.findByUsername(request.username()).orElseThrow(
        () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid candidate credentials")
    );
    if (!passwordEncoder.matches(request.password(), candidate.getPassword())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid candidate credentials");
    }
    return Map.of("user", candidate, "role", "CANDIDATE");
  }

  @PostMapping("/auth/recruiter/login")
  public Map<String, Object> loginRecruiter(@RequestBody LoginRequest request) {
    Recruiter recruiter = recruiters.findByUsername(request.username()).orElseThrow(
        () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid recruiter credentials")
    );
    if (!passwordEncoder.matches(request.password(), recruiter.getPassword())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid recruiter credentials");
    }
    return Map.of("user", recruiter, "role", "RECRUITER");
  }

  @GetMapping("/jobs")
  public List<Job> listJobs() {
    return jobs.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
        .filter(job -> !"DELETED".equalsIgnoreCase(job.getStatus()))
        .toList();
  }

  @GetMapping("/jobs/open")
  public List<Job> openJobs() {
    return jobs.findByStatusOrderByCreatedAtDesc("OPEN");
  }

  @PostMapping("/jobs")
  @ResponseStatus(HttpStatus.CREATED)
  public Job createJob(@Valid @RequestBody Job job) {
    if (job.getTitle() == null || job.getTitle().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Job title is required");
    }
    if (job.getDescription() == null || job.getDescription().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Job description is required");
    }
    job.setId(null);
    if (job.getStatus() == null || job.getStatus().isBlank()) {
      job.setStatus("OPEN");
    }
    return jobs.save(job);
  }

  @PutMapping("/jobs/{id}")
  public Job updateJob(@PathVariable String id, @Valid @RequestBody Job updates) {
    Job job = jobs.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
    if (updates.getTitle() == null || updates.getTitle().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Job title is required");
    }
    if (updates.getDescription() == null || updates.getDescription().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Job description is required");
    }
    job.setTitle(updates.getTitle());
    job.setDescription(updates.getDescription());
    job.setCompanyName(updates.getCompanyName());
    job.setDepartment(updates.getDepartment());
    job.setLocation(updates.getLocation());
    job.setEmploymentType(updates.getEmploymentType());
    job.setMinExperienceYears(updates.getMinExperienceYears());
    job.setEducationRequirements(updates.getEducationRequirements());
    job.setContactEmail(updates.getContactEmail());
    job.setContactPhone(updates.getContactPhone());
    job.setRequiredSkills(updates.getRequiredSkills() == null ? List.of() : updates.getRequiredSkills());
    if (updates.getStatus() != null && !updates.getStatus().isBlank()) {
      job.setStatus(updates.getStatus());
    }
    return jobs.save(job);
  }

  @DeleteMapping("/jobs/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteJob(@PathVariable String id) {
    Job job = jobs.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
    job.setStatus("DELETED");
    jobs.save(job);
  }

  @PutMapping("/candidates/{id}/profile")
  public Candidate updateCandidateProfile(@PathVariable String id, @RequestBody CandidateProfileRequest request) {
    Candidate candidate = candidates.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));
    validateLength(request.name(), 255, "name");
    validateLength(request.email(), 255, "email");
    validateLength(request.phone(), 255, "phone");
    validateLength(request.education(), 255, "education");
    validateLength(request.skills(), 255, "skills");
    validateLength(request.summary(), 2000, "summary");
    candidate.setName(request.name());
    candidate.setEmail(request.email());
    candidate.setPhone(request.phone());
    candidate.setEducation(request.education());
    candidate.setSkills(request.skills());
    candidate.setSummary(request.summary());
    return candidates.save(candidate);
  }

  @GetMapping("/candidates")
  public List<Candidate> listCandidates() {
    return candidates.findAll();
  }

  @PostMapping("/candidates")
  @ResponseStatus(HttpStatus.CREATED)
  public Candidate createCandidate(@Valid @RequestBody Candidate candidate) {
    candidate.setId(null);
    if (candidate.getResumeText() == null || candidate.getResumeText().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resumeText is required");
    }
    return candidates.save(candidate);
  }

  @PostMapping("/candidates/{id}/analyze")
  public Candidate analyze(@PathVariable String id) {
    Candidate c = candidates.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));
    if (c.getResumeText() == null || c.getResumeText().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Candidate resume text is required to analyze");
    }
    String prompt = "You are an assistant helping a recruiter organize resume information. Extract only evidence explicitly present in the resume. Do not infer protected traits or make a hiring decision. Return concise JSON with keys skills (array), experience_summary (string), education (array), and follow_up_questions (array). Resume:\n" + c.getResumeText();
    c.setExtractedProfile(gemini.generate(prompt));
    return candidates.save(c);
  }

  @PostMapping("/applications")
  @ResponseStatus(HttpStatus.CREATED)
  public JobApplication apply(@Valid @RequestBody ApplicationRequest request) {
    if (request.jobId() == null || request.jobId().isBlank()
        || request.candidateId() == null || request.candidateId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "jobId and candidateId are required");
    }
    validateLength(request.coverLetter(), 12000, "coverLetter");
    validateLength(request.resumeText(), 16000, "resumeText");
    validateLength(request.resumeFileName(), 255, "resumeFileName");
    validateLength(request.phone(), 255, "phone");
    validateLength(request.education(), 255, "education");
    validateLength(request.experienceSummary(), 255, "experienceSummary");
    validateLength(request.skills(), 255, "skills");

    Job job = jobs.findById(request.jobId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
    Candidate candidate = candidates.findById(request.candidateId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));
    if (applications.existsByCandidate_IdAndJob_Id(candidate.getId(), job.getId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already applied for this job.");
    }

    String resumeText = request.resumeText();
    if (resumeText != null && resumeText.isBlank()) {
      resumeText = null;
    }
    if (resumeText == null || resumeText.isBlank()) {
      resumeText = candidate.getResumeText();
    }
    if (resumeText == null || resumeText.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resumeText is required");
    }

    String normalizedSkills = (request.skills() == null || request.skills().isBlank()) ? candidate.getSkills() : request.skills();
    String normalizedEducation = (request.education() == null || request.education().isBlank()) ? candidate.getEducation() : request.education();
    String normalizedPhone = (request.phone() == null || request.phone().isBlank()) ? candidate.getPhone() : request.phone();
    String normalizedExperience = (request.experienceSummary() == null || request.experienceSummary().isBlank()) ? "Experience details not provided" : request.experienceSummary();

    int score = AtsScoringService.calculateAtsScore(job.getDescription(), resumeText);
    String summary = "ATS score: " + score + "/100. The candidate profile aligns with the job description based on keyword and experience match. Review for final hiring decision.";

    JobApplication application = new JobApplication();
    application.setJob(job);
    application.setCandidate(candidate);
    application.setCoverLetter(request.coverLetter());
    application.setResumeText(resumeText);
    application.setResumeFileName(request.resumeFileName());
    application.setPhone(normalizedPhone);
    application.setEducation(normalizedEducation);
    application.setExperienceSummary(normalizedExperience);
    application.setSkills(normalizedSkills);
    application.setAtsScore(score);
    application.setAiSummary(summary);
    application.setStatus("PENDING");
    try {
      return applications.save(application);
    } catch (DataIntegrityViolationException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already applied for this job.", exception);
    }
  }

  private static void validateLength(String value, int maxLength, String field) {
    if (value != null && value.length() > maxLength) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be " + maxLength + " characters or fewer");
    }
  }

  @GetMapping("/applications/{id}/ats")
  public Map<String, Object> atsReview(@PathVariable String id) {
    JobApplication application = applications.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
    int score = application.getAtsScore() != null ? application.getAtsScore() : 0;
    return Map.of(
        "applicationId", application.getId(),
        "score", score,
        "summary", application.getAiSummary() != null ? application.getAiSummary() : "No AI summary yet.",
        "status", application.getStatus()
    );
  }

  @PostMapping("/applications/{id}/ats/recalculate")
  public JobApplication recalculateAts(@PathVariable String id) {
    JobApplication application = applications.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
    int score = AtsScoringService.calculateAtsScore(application.getJob().getDescription(), application.getResumeText());
    application.setAtsScore(score);
    application.setAiSummary("Candidate profile: " + candidateSummary(application)
        + " ATS match score: " + score + "/100. Review the resume and interview evidence before making a hiring decision.");
    return applications.save(application);
  }

  private static String candidateSummary(JobApplication application) {
    List<String> details = new ArrayList<>();
    if (application.getExperienceSummary() != null && !application.getExperienceSummary().isBlank()) {
      details.add(application.getExperienceSummary().trim());
    }
    if (application.getSkills() != null && !application.getSkills().isBlank()) {
      details.add("Skills: " + application.getSkills().trim());
    }
    if (application.getEducation() != null && !application.getEducation().isBlank()) {
      details.add("Education: " + application.getEducation().trim());
    }
    return details.isEmpty() ? "Candidate details are limited; review the submitted resume." : String.join(" ", details);
  }

  @GetMapping("/jobs/{id}/applications")
  public List<JobApplication> listApplicationsForJob(@PathVariable String id) {
    return applications.findByJob_IdOrderByCreatedAtDesc(id);
  }

  @GetMapping("/candidates/{id}/applications")
  public List<JobApplication> listApplicationsForCandidate(@PathVariable String id) {
    return applications.findByCandidate_IdOrderByCreatedAtDesc(id);
  }

  @DeleteMapping("/candidates/{candidateId}/applications/{applicationId}")
  public JobApplication revokeApplication(@PathVariable String candidateId, @PathVariable String applicationId) {
    JobApplication application = applications.findById(applicationId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
    if (!application.getCandidate().getId().equals(candidateId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only revoke your own applications.");
    }
    if (!"PENDING".equals(application.getStatus())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Only pending applications can be revoked.");
    }
    application.setStatus("WITHDRAWN");
    return applications.save(application);
  }

  @PostMapping("/resumes/parse")
  public Map<String, String> parseResume(@RequestParam("file") MultipartFile file) {
    if (file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a non-empty resume file.");
    }
    if (file.getSize() > 10 * 1024 * 1024) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resume files must be 10 MB or smaller.");
    }
    String filename = Objects.requireNonNullElse(file.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
    try {
      String text;
      if (filename.endsWith(".pdf")) {
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
          text = new PDFTextStripper().getText(document);
        }
      } else if (filename.endsWith(".txt")) {
        text = new String(file.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
      } else {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please choose a PDF or plain-text (.txt) resume.");
      }
      text = text.trim();
      if (text.isBlank()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No selectable text was found. Scanned PDFs need OCR before upload.");
      }
      if (text.length() > 16000) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resume must contain 16,000 characters or fewer.");
      }
      return Map.of("text", text);
    } catch (ResponseStatusException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read this resume. Check that the PDF is valid and not password-protected.");
    }
  }

  @PostMapping("/applications/{id}/candidate-report")
  public Map<String, Object> candidateReport(@PathVariable String id) {
    JobApplication application = applications.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
    String prompt = "Prepare a concise, evidence-grounded candidate report from the job and resume below. Return ONLY valid JSON with keys matched_skills (array of strings: resume skills supported by job requirements), missing_skills (array of job requirements not evidenced in the resume), extra_skills (array of resume skills not requested by the job), and summary (exactly 2 or 3 short paragraphs separated by a blank line). The paragraphs should explain the candidate's professional background, what skills/experience the resume demonstrates, and how well that evidence aligns with this role. Do not infer protected characteristics, invent facts, or make a hiring decision. Treat unsupported requirements as unclear rather than proof of inability.\nJOB TITLE: "
        + application.getJob().getTitle() + "\nJOB DESCRIPTION: " + application.getJob().getDescription()
        + "\nREQUIRED SKILLS: " + String.join(", ", application.getJob().getRequiredSkills() == null ? List.of() : application.getJob().getRequiredSkills())
        + "\nRESUME: " + application.getResumeText();
    try {
      String response = gemini.generate(prompt).trim().replaceAll("^```(?:json)?\\s*|\\s*```$", "");
      JsonNode report = objectMapper.readTree(response);
      String summary = report.path("summary").asText("").trim();
      int paragraphCount = summary.isEmpty() ? 0 : summary.split("\\R\\s*\\R").length;
      if (!report.path("matched_skills").isArray() || !report.path("missing_skills").isArray()
          || !report.path("extra_skills").isArray() || paragraphCount < 2 || paragraphCount > 3) {
        throw new IllegalStateException("AI returned an incomplete candidate report. Please try again.");
      }
      return Map.of(
          "matchedSkills", jsonStrings(report.path("matched_skills")),
          "missingSkills", jsonStrings(report.path("missing_skills")),
          "extraSkills", jsonStrings(report.path("extra_skills")),
          "summary", summary,
          "notice", "AI-generated summary may be inaccurate. Review the original resume and job description."
      );
    } catch (Exception exception) {
      if (exception instanceof IllegalStateException stateException) throw stateException;
      throw new IllegalStateException("Unable to format the candidate report. Please try again.", exception);
    }
  }

  private static List<String> jsonStrings(JsonNode node) {
    if (!node.isArray()) return List.of();
    List<String> values = new ArrayList<>();
    node.forEach(value -> {
      if (value.isTextual() && !value.asText().isBlank()) values.add(value.asText());
    });
    return values;
  }

  @GetMapping("/recruiter/applications")
  public List<JobApplication> listAllApplications() {
    return applications.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
  }

  @PutMapping("/applications/{id}/status")
  public JobApplication updateApplicationStatus(@PathVariable String id, @RequestParam String status) {
    JobApplication application = applications.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
    String normalized = status.trim().toUpperCase(Locale.ROOT);
    if (!Set.of("PENDING", "SELECTED", "REJECTED").contains(normalized)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be PENDING, SELECTED or REJECTED");
    }
    application.setStatus(normalized);
    return applications.save(application);
  }

  @PostMapping("/match")
  public Map<String, Object> match(@RequestBody MatchRequest request) {
    if (request.jobDescription() == null || request.jobDescription().isBlank() || request.resumeText() == null || request.resumeText().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "jobDescription and resumeText are required");
    }
    Map<String, Object> result = new LinkedHashMap<>(rag.analyze(request.jobDescription(), request.resumeText()));
    result.put("atsScore", AtsScoringService.calculateAtsScore(request.jobDescription(), request.resumeText()));
    return result;
  }

  @PostMapping("/interview-questions")
  public Map<String, String> questions(@RequestBody Map<String, String> body) {
    String role = body.getOrDefault("role", "Software Engineer");
    String description = body.getOrDefault("jobDescription", "");
    return Map.of("questions", gemini.generate("Generate 8 role-relevant interview questions, mixing technical and behavioral questions. Do not assume candidate attributes. Role: " + role + "\nJob description: " + description));
  }

  public record LoginRequest(String username, String password) {}
  public record CandidateProfileRequest(String name, String email, String phone, String education, String skills, String summary) {}
  public record RecruiterProfileRequest(String fullName, String companyName, String email, String phone) {}
  public record ApplicationRequest(String jobId, String candidateId, String coverLetter, String resumeText, String resumeFileName, String phone, String education, String experienceSummary, String skills) {}
  public record MatchRequest(String jobDescription, String resumeText) {}
}
