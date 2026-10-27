package com.portfolio.recruitment;

import com.portfolio.recruitment.model.Job;
import com.portfolio.recruitment.repo.JobRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class DataSeeder implements CommandLineRunner {
  private final JobRepository jobs;

  public DataSeeder(JobRepository jobs) {
    this.jobs = jobs;
  }

  @Override
  public void run(String... args) {
    List<Job> sampleJobs = List.of(
      createJob("Senior Java Developer", "NorthStar Labs", "Engineering", "Remote, US", "Full-time", 4,
        "Build scalable backend systems and resilient services for products used by millions of customers.",
        List.of("Java", "Spring Boot", "REST APIs", "PostgreSQL", "Microservices"), "Bachelor's degree in Computer Science or related field"),
      createJob("Frontend Engineer", "NorthStar Labs", "Product", "San Francisco, CA", "Hybrid", 2,
        "Build accessible, responsive web experiences using React, TypeScript, and modern design systems.",
        List.of("React", "JavaScript", "TypeScript", "CSS", "REST APIs"), "Bachelor's degree preferred"),
      createJob("Full Stack Developer", "BrightLayer", "Engineering", "Remote, US", "Full-time", 3,
        "Ship end-to-end product features across a React frontend and Node.js services.",
        List.of("React", "Node.js", "TypeScript", "PostgreSQL", "AWS"), "Bachelor's degree or equivalent experience"),
      createJob("Python Backend Engineer", "CloudHarbor", "Platform", "Austin, TX", "Full-time", 3,
        "Design reliable Python APIs and data services for a growing cloud platform.",
        List.of("Python", "FastAPI", "Docker", "PostgreSQL", "Redis"), "Bachelor's degree in Computer Science or equivalent"),
      createJob("DevOps Engineer", "Orbit Systems", "Infrastructure", "Remote, US", "Full-time", 4,
        "Improve deployment reliability and developer workflows across a Kubernetes-based platform.",
        List.of("Kubernetes", "AWS", "Terraform", "CI/CD", "Linux"), "Bachelor's degree preferred"),
      createJob("Cloud Solutions Architect", "NimbusWorks", "Cloud", "Seattle, WA", "Full-time", 7,
        "Guide cloud architecture decisions and help engineering teams build secure, scalable systems.",
        List.of("AWS", "Azure", "Cloud Architecture", "Networking", "Security"), "Bachelor's degree in a technical field"),
      createJob("Data Engineer", "Metric Grove", "Data", "New York, NY", "Hybrid", 3,
        "Build dependable data pipelines and models that power analytics and customer-facing insights.",
        List.of("Python", "SQL", "Apache Spark", "Airflow", "ETL"), "Bachelor's degree in Computer Science, Statistics, or related field"),
      createJob("Machine Learning Engineer", "Cortex Labs", "AI Research", "Remote, US", "Full-time", 4,
        "Productionize machine learning models and build robust inference services for real-world applications.",
        List.of("Python", "PyTorch", "Machine Learning", "MLOps", "Docker"), "Master's degree preferred"),
      createJob("Cybersecurity Analyst", "Redwood Security", "Security", "Washington, DC", "Full-time", 2,
        "Monitor security signals, investigate incidents, and strengthen controls across a modern cloud environment.",
        List.of("SIEM", "Incident Response", "Network Security", "Linux", "Python"), "Bachelor's degree or relevant security certification"),
      createJob("QA Automation Engineer", "PixelForge", "Quality Engineering", "Remote, US", "Full-time", 3,
        "Create maintainable automated test suites that protect a fast-moving web product.",
        List.of("Playwright", "JavaScript", "API Testing", "CI/CD", "Selenium"), "Bachelor's degree preferred"),
      createJob("iOS Developer", "Lumen Mobile", "Mobile", "Los Angeles, CA", "Full-time", 3,
        "Deliver polished iOS experiences and collaborate closely with design and product teams.",
        List.of("Swift", "SwiftUI", "iOS", "REST APIs", "Xcode"), "Bachelor's degree or equivalent experience"),
      createJob("Android Developer", "Greenline Apps", "Mobile", "Remote, US", "Full-time", 3,
        "Build reliable Android features with a focus on performance, accessibility, and quality.",
        List.of("Kotlin", "Android", "Jetpack Compose", "REST APIs", "Git"), "Bachelor's degree preferred"),
      createJob("Product Designer, UX/UI", "Form & Function", "Design", "New York, NY", "Hybrid", 4,
        "Shape user-centered workflows from early research through high-fidelity prototypes and delivery.",
        List.of("Figma", "User Research", "Prototyping", "Design Systems", "Accessibility"), "Portfolio demonstrating shipped digital products"),
      createJob("Site Reliability Engineer", "Evergreen Compute", "Infrastructure", "Remote, US", "Full-time", 5,
        "Keep critical services fast and available through automation, observability, and thoughtful incident response.",
        List.of("Kubernetes", "Prometheus", "Go", "Linux", "Terraform"), "Bachelor's degree or equivalent experience"),
      createJob("Blockchain Developer", "LedgerPeak", "Web3", "Remote, US", "Full-time", 3,
        "Develop and review smart contracts and integrations for secure decentralized applications.",
        List.of("Solidity", "Ethereum", "Web3.js", "Hardhat", "TypeScript"), "Bachelor's degree in a technical field preferred"),
      createJob("Database Administrator", "BlueOak Finance", "Data Infrastructure", "Chicago, IL", "Full-time", 4,
        "Maintain secure, high-performing relational databases and support data availability across teams.",
        List.of("PostgreSQL", "SQL", "Database Tuning", "Backup and Recovery", "AWS"), "Bachelor's degree or equivalent experience"),
      createJob("IT Support Specialist", "Summit Health Tech", "IT Operations", "Denver, CO", "Full-time", 1,
        "Provide friendly technical support and keep employee devices, accounts, and workplace systems running.",
        List.of("Windows", "macOS", "Troubleshooting", "Networking", "ITSM"), "Associate degree or relevant experience"),
      createJob("Network Engineer", "SignalPath", "Networking", "Dallas, TX", "Full-time", 4,
        "Design, operate, and troubleshoot secure network infrastructure across offices and cloud environments.",
        List.of("TCP/IP", "Cisco", "Firewalls", "VPN", "Network Monitoring"), "Bachelor's degree or networking certification"),
      createJob("Technical Product Manager", "Launchpad Software", "Product", "Boston, MA", "Full-time", 5,
        "Translate customer needs and business goals into a clear roadmap for a developer-focused SaaS product.",
        List.of("Product Strategy", "Agile", "Analytics", "APIs", "Stakeholder Management"), "Bachelor's degree preferred"),
      createJob("Software Engineering Intern", "OpenSky Digital", "Engineering", "Remote, US", "Internship", 0,
        "Pair with experienced engineers to build, test, and ship features for a production web application.",
        List.of("JavaScript", "React", "Git", "Problem Solving", "REST APIs"), "Currently pursuing a degree in Computer Science or related field")
    );
    Set<String> existingJobs = jobs.findAll().stream()
      .map(job -> job.getCompanyName() + "|" + job.getTitle())
      .collect(Collectors.toSet());
    sampleJobs.stream()
      .filter(job -> !existingJobs.contains(job.getCompanyName() + "|" + job.getTitle()))
      .forEach(jobs::save);
  }

  private Job createJob(String title, String company, String department, String location, String employmentType,
                        int experienceYears, String description, List<String> skills, String education) {
    Job job = new Job();
    job.setTitle(title);
    job.setCompanyName(company);
    job.setDepartment(department);
    job.setLocation(location);
    job.setEmploymentType(employmentType);
    job.setMinExperienceYears(experienceYears);
    job.setDescription(description);
    job.setRequiredSkills(skills);
    job.setEducationRequirements(education);
    job.setContactEmail("recruiter@northstarlabs.com");
    job.setContactPhone("+1-415-555-9012");
    job.setStatus("OPEN");
    return job;
  }
}
