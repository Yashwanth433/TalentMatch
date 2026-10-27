package com.portfolio.recruitment;
import com.portfolio.recruitment.repo.JobRepository;
import com.portfolio.recruitment.repo.CandidateRepository;
import com.portfolio.recruitment.repo.RecruiterRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:hirewise-seed-test;DB_CLOSE_DELAY=-1")
class RecruitmentApplicationTests {
  @Autowired private JobRepository jobs;
  @Autowired private CandidateRepository candidates;
  @Autowired private RecruiterRepository recruiters;
  @Autowired private DataSeeder seeder;

  @Test void seedsTwentySampleJobsWithoutDuplicates() {
    assertEquals(20, jobs.count());
    seeder.run();
    assertEquals(20, jobs.count());
    assertEquals(0, candidates.count());
    assertEquals(0, recruiters.count());
  }
}
