package com.portfolio.recruitment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.recruitment.model.Candidate;
import com.portfolio.recruitment.model.Job;
import com.portfolio.recruitment.model.JobApplication;
import com.portfolio.recruitment.repo.ApplicationRepository;
import com.portfolio.recruitment.repo.CandidateRepository;
import com.portfolio.recruitment.repo.JobRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:hirewise-app-test;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
class ApplicationSubmissionTests {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Autowired
  private CandidateRepository candidateRepository;

  @Autowired
  private JobRepository jobRepository;

  @Autowired
  private ApplicationRepository applicationRepository;

  @Test
  void candidateAndRecruiterMustRegisterBeforeLoggingIn() throws Exception {
    String suffix = java.util.UUID.randomUUID().toString();
    String candidateUsername = "candidate-" + suffix;
    String recruiterUsername = "recruiter-" + suffix;

    mockMvc.perform(post("/api/auth/candidate/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username": "cand1", "password": "cand1"}
                """))
        .andExpect(status().isUnauthorized());

    mockMvc.perform(post("/api/auth/candidate/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username": "%s", "password": "candidate-secret", "name": "New Candidate"}
                """.formatted(candidateUsername)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.password").doesNotExist());

    mockMvc.perform(post("/api/auth/candidate/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username": "%s", "password": "candidate-secret"}
                """.formatted(candidateUsername)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("CANDIDATE"))
        .andExpect(jsonPath("$.user.password").doesNotExist());

    mockMvc.perform(post("/api/auth/recruiter/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username": "%s", "password": "recruiter-secret", "fullName": "New Recruiter", "companyName": "Example Co"}
                """.formatted(recruiterUsername)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.password").doesNotExist());

    mockMvc.perform(post("/api/auth/recruiter/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username": "%s", "password": "recruiter-secret"}
                """.formatted(recruiterUsername)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("RECRUITER"))
        .andExpect(jsonPath("$.user.password").doesNotExist());
  }

  @Test
  void submitApplicationWithProfileResumeCreatesApplication() throws Exception {
    Candidate candidate = new Candidate();
    candidate.setName("Test Candidate");
    candidate.setUsername("submit-candidate");
    candidate.setPassword("secret123");
    candidate.setEmail("candidate@example.com");
    candidate.setPhone("+91-9000000000");
    candidate.setEducation("B.Tech in Computer Science");
    candidate.setSkills("Java, Spring Boot, SQL");
    candidate.setResumeText("Java developer with 4 years of experience in Spring Boot, REST APIs, and SQL.");
    candidate = candidateRepository.save(candidate);

    Job job = new Job();
    job.setTitle("Java Developer");
    job.setDescription("Senior Java developer with Spring Boot, REST APIs, SQL, and microservices experience.");
    job.setCompanyName("NorthStar Labs");
    job.setDepartment("Engineering");
    job.setLocation("Remote");
    job.setEmploymentType("Full-time");
    job.setMinExperienceYears(3);
    job.setRequiredSkills(List.of("Java", "Spring Boot", "REST APIs", "SQL"));
    job.setEducationRequirements("Bachelor's degree");
    job.setContactEmail("recruiter@northstarlabs.com");
    job.setStatus("OPEN");
    job = jobRepository.save(job);

    String payload = "{\n"
        + "  \"jobId\": \"" + job.getId() + "\",\n"
        + "  \"candidateId\": \"" + candidate.getId() + "\",\n"
        + "  \"coverLetter\": \"Hi team, I am very interested in this role.\",\n"
        + "  \"phone\": \"+91-9000000000\",\n"
        + "  \"education\": \"B.Tech in Computer Science\",\n"
        + "  \"experienceSummary\": \"4 years of backend development in Java and Spring Boot.\",\n"
        + "  \"skills\": \"Java, Spring Boot, SQL\"\n"
        + "}";

    mockMvc.perform(post("/api/applications")
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("PENDING"));

    mockMvc.perform(post("/api/applications")
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error").value("You have already applied for this job."));

    String candidateId = candidate.getId();
    String jobId = job.getId();
    assert applicationRepository.findAll().stream().anyMatch(app -> app.getCandidate().getId().equals(candidateId)
        && app.getJob().getId().equals(jobId));
  }

  @Test
  void rejectsResumeExceedingStorageLimitWithBadRequest() throws Exception {
    String payload = """
        {
          "jobId": 1,
          "candidateId": 1,
          "resumeText": "%s"
        }
        """.formatted("a".repeat(16001));

    mockMvc.perform(post("/api/applications")
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("resumeText must be 16000 characters or fewer"));
  }

  @Test
  void parsesTextFromPdfResumeUpload() throws Exception {
    byte[] pdf;
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      document.addPage(new PDPage());
      try (PDPageContentStream content = new PDPageContentStream(document, document.getPage(0))) {
        content.beginText();
        content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
        content.newLineAtOffset(50, 700);
        content.showText("Java and Spring Boot resume");
        content.endText();
      }
      document.save(output);
      pdf = output.toByteArray();
    }

    MockMultipartFile resume = new MockMultipartFile("file", "candidate.pdf", "application/pdf", pdf);
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
            .multipart("/api/resumes/parse").file(resume))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.text").value(org.hamcrest.Matchers.containsString("Java and Spring Boot resume")));
  }

  @Test
  void recruiterCanEditAndDeleteAJobWithoutApplications() throws Exception {
    Job job = createJob("Old title");
    String update = """
        {
          "title": "Updated title",
          "description": "Updated role description",
          "companyName": "NorthStar Labs",
          "requiredSkills": ["Java"]
        }
        """;

    mockMvc.perform(put("/api/jobs/{id}", job.getId())
            .contentType(MediaType.APPLICATION_JSON)
            .content(update))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Updated title"));

    mockMvc.perform(delete("/api/jobs/{id}", job.getId()))
        .andExpect(status().isNoContent());
  }

  @Test
  void recruiterCanDeleteAJobAndKeepItsApplications() throws Exception {
    Candidate candidate = createCandidate("delete-protected-candidate");
    Job job = createJob("Protected job");
    JobApplication application = new JobApplication();
    application.setCandidate(candidate);
    application.setJob(job);
    application.setResumeText(candidate.getResumeText());
    applicationRepository.save(application);

    mockMvc.perform(delete("/api/jobs/{id}", job.getId()))
        .andExpect(status().isNoContent());

    mockMvc.perform(get("/api/jobs"))
        .andExpect(status().isOk())
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(
            org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Protected job"))));
    org.junit.jupiter.api.Assertions.assertTrue(applicationRepository.existsById(application.getId()));

    mockMvc.perform(post("/api/applications")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"jobId": "%s", "candidateId": "%s", "resumeText": "Experienced Java backend developer."}
                """.formatted(job.getId(), candidate.getId())))
        .andExpect(status().isConflict());
  }

  @Test
  void recruiterCanRecalculateApplicationAtsScore() throws Exception {
    Candidate candidate = createCandidate("ats-recalculate-candidate");
    Job job = createJob("Java API Developer");
    job.setDescription("Java backend developer with REST APIs");
    jobRepository.save(job);
    JobApplication application = new JobApplication();
    application.setCandidate(candidate);
    application.setJob(job);
    application.setResumeText(candidate.getResumeText());
    application.setSkills("Java, REST APIs");
    application.setEducation("BSc");
    application.setExperienceSummary("Experienced backend developer.");
    application = applicationRepository.save(application);

    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
            .post("/api/applications/{id}/ats/recalculate", application.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.atsScore").isNumber())
        .andExpect(jsonPath("$.aiSummary").value(org.hamcrest.Matchers.containsString("Candidate profile:")));
  }

  @Test
  void candidateCanRevokeTheirPendingApplication() throws Exception {
    Candidate candidate = createCandidate("revoke-candidate");
    Job job = createJob("Revoke test job");
    JobApplication application = new JobApplication();
    application.setCandidate(candidate);
    application.setJob(job);
    application.setResumeText(candidate.getResumeText());
    application = applicationRepository.save(application);

    mockMvc.perform(delete("/api/candidates/{candidateId}/applications/{applicationId}", candidate.getId(), application.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("WITHDRAWN"));

    org.junit.jupiter.api.Assertions.assertTrue(applicationRepository.existsById(application.getId()));
  }

  @Test
  void candidateCanSaveProfessionalSummary() throws Exception {
    Candidate candidate = createCandidate("profile-summary-candidate");
    String profile = """
        {
          "name": "Updated Candidate",
          "email": "updated@example.com",
          "phone": "+1-555-0100",
          "education": "BSc",
          "skills": "Java",
          "summary": "Backend engineer focused on reliable APIs."
        }
        """;

    mockMvc.perform(put("/api/candidates/{id}/profile", candidate.getId())
            .contentType(MediaType.APPLICATION_JSON)
            .content(profile))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.summary").value("Backend engineer focused on reliable APIs."));
  }

  private Candidate createCandidate(String username) {
    Candidate candidate = new Candidate();
    candidate.setName("Test Candidate");
    candidate.setUsername(username);
    candidate.setPassword("secret123");
    candidate.setEmail(username + "@example.com");
    candidate.setResumeText("Java developer with experience building APIs.");
    return candidateRepository.save(candidate);
  }

  private Job createJob(String title) {
    Job job = new Job();
    job.setTitle(title);
    job.setDescription("Role description for testing.");
    job.setCompanyName("NorthStar Labs");
    job.setRequiredSkills(List.of("Java"));
    return jobRepository.save(job);
  }
}
