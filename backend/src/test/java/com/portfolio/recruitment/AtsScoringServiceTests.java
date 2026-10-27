package com.portfolio.recruitment;

import com.portfolio.recruitment.model.Job;
import com.portfolio.recruitment.model.JobApplication;
import com.portfolio.recruitment.service.AtsScoringService;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;

class AtsScoringServiceTests {

  @Test
  void atsScoreRewardsRelevantKeywordsAndExperience() {
    String jobDescription = "Senior Java developer with Spring Boot, REST APIs, PostgreSQL, microservices, and Kubernetes experience";
    String resume = "Java developer with 5 years of experience building REST APIs in Spring Boot, PostgreSQL, microservices, and Kubernetes.";

    int score = AtsScoringService.calculateAtsScore(jobDescription, resume);

    assertTrue(score >= 80, "Expected a strong ATS score when the resume covers the role requirements");
    assertTrue(score <= 100, "ATS score should remain within the valid range");
  }

  @Test
  void atsScoreDropsWhenSkillsAreMissing() {
    String jobDescription = "Full stack engineer with React, Node.js, Java, AWS, and SQL";
    String resume = "Marketing professional with brand strategy and campaign management experience.";

    int score = AtsScoringService.calculateAtsScore(jobDescription, resume);

    assertTrue(score < 40, "Missing role-specific keywords should reduce the ATS score substantially");
  }

  @Test
  void jpaEntitiesKeepApplicationRelationsAndUniqueness() throws NoSuchFieldException {
    assertNotNull(Job.class.getAnnotation(Entity.class));

    Field jobRelation = JobApplication.class.getDeclaredField("job");
    assertNotNull(jobRelation.getAnnotation(ManyToOne.class), "JobApplication.job should be a relational reference");

    Field candidateRelation = JobApplication.class.getDeclaredField("candidate");
    assertNotNull(candidateRelation.getAnnotation(ManyToOne.class), "JobApplication.candidate should be a relational reference");
    assertTrue(java.util.Arrays.stream(JobApplication.class.getAnnotation(Table.class).uniqueConstraints())
        .anyMatch(constraint -> constraint.name().equals("candidate_job_unique")
            && java.util.Arrays.equals(constraint.columnNames(), new String[] {"candidate_id", "job_id"})),
        "Applications should prevent duplicate candidate/job submissions");
  }
}
