package com.portfolio.recruitment.repo;

import com.portfolio.recruitment.model.Candidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CandidateRepository extends JpaRepository<Candidate, String> {
  Optional<Candidate> findByUsername(String username);
}
