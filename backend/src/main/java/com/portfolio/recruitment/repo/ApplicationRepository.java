package com.portfolio.recruitment.repo;

import com.portfolio.recruitment.model.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApplicationRepository extends JpaRepository<JobApplication, String> {
  List<JobApplication> findByJob_IdOrderByCreatedAtDesc(String jobId);
  List<JobApplication> findByCandidate_IdOrderByCreatedAtDesc(String candidateId);
  boolean existsByCandidate_IdAndJob_Id(String candidateId, String jobId);
}
