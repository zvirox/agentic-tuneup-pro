use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthDeduction {
    pub category: String,
    pub points: u8,
    pub reason: String,
    pub action_label: String,
    pub target_page: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthScore {
    pub score: u8,
    pub rating: String,
    pub deductions: Vec<HealthDeduction>,
}

impl HealthScore {
    pub fn calculate(
        disk_used_percent: f32,
        mem_used_percent: f32,
        temp_celsius: Option<f32>,
        pending_updates: usize,
        reclaimable_bytes: u64,
    ) -> Self {
        let mut score: i32 = 100;
        let mut deductions = Vec::new();

        // 1. Disk pressure deduction
        if disk_used_percent > 85.0 {
            let pts = (((disk_used_percent - 85.0) / 15.0) * 30.0).min(30.0) as u8;
            if pts > 0 {
                score -= pts as i32;
                deductions.push(HealthDeduction {
                    category: "disk".into(),
                    points: pts,
                    reason: format!("Disk storage is {:.1}% full", disk_used_percent),
                    action_label: "Free Disk Space".into(),
                    target_page: "clean".into(),
                });
            }
        }

        // 2. Memory pressure deduction
        if mem_used_percent > 90.0 {
            let pts = (((mem_used_percent - 90.0) / 10.0) * 25.0).min(25.0) as u8;
            if pts > 0 {
                score -= pts as i32;
                deductions.push(HealthDeduction {
                    category: "memory".into(),
                    points: pts,
                    reason: format!("Memory utilization is critically high ({:.1}%)", mem_used_percent),
                    action_label: "Inspect Processes".into(),
                    target_page: "proc".into(),
                });
            }
        }

        // 3. Thermal deduction
        if let Some(temp) = temp_celsius {
            if temp > 80.0 {
                let pts = (((temp - 80.0) / 15.0) * 15.0).min(15.0) as u8;
                if pts > 0 {
                    score -= pts as i32;
                    deductions.push(HealthDeduction {
                        category: "thermal".into(),
                        points: pts,
                        reason: format!("CPU temperature is high ({:.1}°C)", temp),
                        action_label: "Check CPU Hogs".into(),
                        target_page: "proc".into(),
                    });
                }
            }
        }

        // 4. Pending updates deduction
        if pending_updates > 0 {
            let pts = (pending_updates as u8 / 2).min(15);
            if pts > 0 {
                score -= pts as i32;
                deductions.push(HealthDeduction {
                    category: "updates".into(),
                    points: pts,
                    reason: format!("{pending_updates} software updates are available"),
                    action_label: "Update Apps".into(),
                    target_page: "apps".into(),
                });
            }
        }

        // 5. Junk bloat deduction (every 2 GB = 1 point, max 15 points)
        let gigabytes = reclaimable_bytes as f64 / 1_073_741_824.0;
        if gigabytes > 2.0 {
            let pts = ((gigabytes / 2.0) as u8).min(15);
            if pts > 0 {
                score -= pts as i32;
                deductions.push(HealthDeduction {
                    category: "junk".into(),
                    points: pts,
                    reason: format!("{gigabytes:.1} GB of reclaimable junk detected"),
                    action_label: "Clean Junk".into(),
                    target_page: "clean".into(),
                });
            }
        }

        let clamped_score = score.clamp(0, 100) as u8;
        let rating = match clamped_score {
            85..=100 => "good",
            65..=84 => "fair",
            _ => "poor",
        }.to_string();

        Self {
            score: clamped_score,
            rating,
            deductions,
        }
    }
}
