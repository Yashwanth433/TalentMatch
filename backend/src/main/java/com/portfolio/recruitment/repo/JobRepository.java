package com.portfolio.recruitment.repo;

import com.portfolio.recruitment.model.Job;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobRepository extends JpaRepository<Job, String> {
  List<Job> findByStatusOrderByCreatedAtDesc(String status);
}
