package com.portfolio.recruitment.repo;

import com.portfolio.recruitment.model.Recruiter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RecruiterRepository extends JpaRepository<Recruiter, String> {
  Optional<Recruiter> findByUsername(String username);
}
