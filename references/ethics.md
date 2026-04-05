# Ethics & Scientific Integrity

## 1. IRB Compliance Framework

### Protocol Requirements
- All data collection activities operate under an approved Washington University IRB protocol
- Protocol amendments required before: adding new data types, changing sampling frequency, introducing new AI models that affect participant experience
- Annual continuing review with updated data flow diagrams and AI model inventory

### Data Governance
- Designated data steward (PI or delegate) responsible for all participant data
- Data access requests reviewed by PI + IRB-approved data use committee
- External data sharing requires DUA (Data Use Agreement) and IRB approval

---

## 2. Informed Consent for AI-Driven Insights

### Consent Components
Participants must understand and consent to:
1. **Data collection**: What data is collected, how often, and how it's stored
2. **AI processing**: That their data will be analyzed by machine learning models
3. **Insight generation**: That AI-generated insights will be presented to them
4. **Limitations**: That AI insights are informational, not clinical diagnoses
5. **Data retention**: How long data is kept and when it's deleted
6. **Withdrawal rights**: They can withdraw at any time with full data deletion

### Dynamic Consent
- Granular per-module consent (participants can opt into emotional dynamics but not cognitive assessment)
- Consent status stored in DynamoDB with full audit trail
- Re-consent prompted when: new modules added, AI models substantially change, new data sharing partners

### Transparency Requirements
- Every AI-generated insight includes a "How we computed this" expandable section
- Model confidence levels shown where appropriate (e.g., "We're fairly confident...")
- Clear labeling: "AI-generated insight" vs. "Your reported data"

---

## 3. Cross-Cultural Fairness Auditing

### Pre-Deployment Audits
Before any model is deployed to production:

1. **Demographic Parity Check**
   - Positive prediction rate should not differ by > 5% across demographic groups
   - Groups: sex, ethnicity, culture_group, age_band, education_level

2. **Disparate Impact Assessment (4/5ths Rule)**
   - Selection rate for any group ≥ 80% of the highest group's rate
   - Applied to: risk classifications, intervention targeting, trajectory assignments

3. **Calibration Audit**
   - Model probabilities should be well-calibrated within each demographic group
   - Brier score decomposition by group

4. **Representation Check**
   - Training data must include ≥ 30 participants per demographic group
   - Under-represented groups flagged; model outputs carry uncertainty warnings

### Ongoing Monitoring
- Monthly automated fairness audit via `scripts/fairness_audit.py`
- Quarterly human review of audit reports by PI + ethics committee member
- Model retraining triggered if disparate impact ratio falls below 0.80

### Remediation
- If bias detected: model quarantined, root cause analysis, data augmentation or re-weighting, re-audit
- Remediation documented in audit trail with before/after metrics

---

## 4. Reproducibility Standards

### Code & Pipeline Versioning
- All ML pipelines version-controlled in Git with tagged releases
- Model artifacts stored in S3 with version IDs
- Training data snapshots stored alongside model artifacts

### Deterministic Training
- Random seeds pinned for all stochastic operations (`RANDOM_SEED = 42`)
- NumPy, PyTorch, and scikit-learn seeds set via `utils.set_reproducible_seed()`
- Hardware-specific non-determinism documented (GPU vs. CPU)

### Dependency Management
- Python: `requirements.txt` with pinned versions (e.g., `scikit-learn==1.4.2`)
- Node.js: `package-lock.json` committed
- Docker images tagged with SHA for exact environment reproduction

### Audit Trail
- Every model training run logged: hyperparameters, data snapshot ID, metrics, seed, duration
- Every prediction logged: model version, input hash, output, timestamp
- Logs retained for 7 years (matching data retention policy)

---

## 5. Individual vs. Population Data Safeguards

### Individual-Level Protections
- Individual risk scores visible only to: the participant themselves, and authorized researchers under IRB protocol
- No individual data in policy dashboard (enforced by k-anonymity check in API layer)
- Individual data never shared externally without explicit per-instance consent

### Population-Level Protections
- All population visualizations enforce k-anonymity threshold of k ≥ 10
- Small cells suppressed or combined with adjacent groups
- Differentially private noise added to aggregate statistics when population < 100
- No demographic cross-tabulations that could identify individuals (e.g., no "65+ Japanese male in Cohort 3" if n < 10)

### Policy Dashboard Specific
- API middleware validates aggregation level before returning data
- Drill-down limited to pre-approved dimensions
- Export watermarked with requester ID and timestamp

---

## 6. Participant Data Rights

### Right to View
- Participants can view all data collected about them via the Participant Dashboard
- Raw data export available in CSV format via "Download My Data" button

### Right to Export
- Full data export (all modules) delivered within 48 hours of request
- Format: ZIP containing CSV files per entity type + JSON metadata
- Export logged in audit trail

### Right to Delete
- Participants can request full data deletion at any time
- Deletion cascades across all DynamoDB SK patterns for the participant
- S3 data lake copies purged within 30 days
- ML models retrained without participant's data at next scheduled training cycle
- Deletion confirmed to participant via email/notification
- Deletion logged (participant_id + timestamp only, no data retained)

### Right to Pause
- Participants can pause data collection without deleting existing data
- EMA prompts suspended; existing data retained and accessible
- Can resume at any time

---

## 7. Model Transparency & Confidence Reporting

### Transparency Requirements
- All deployed models have a "Model Card" documenting: purpose, training data, performance metrics, known limitations, fairness audit results
- Model cards accessible to researchers via the Researcher Dashboard
- Simplified model descriptions available to participants ("How we analyze your data")

### Confidence Reporting
- All predictions include confidence intervals or probability estimates
- Risk scores accompanied by calibration context (e.g., "Among people with similar profiles, 30% experienced...")
- Trend detections qualified with statistical significance (p-value or Bayesian posterior probability)
- Uncertain predictions explicitly labeled: "Not enough data yet" rather than showing a potentially misleading estimate

### Limitations Disclosure
- Each AI module documents known limitations in its Model Card
- Participant-facing insights include disclaimers: "This is based on patterns in your data and is not a clinical assessment"
- Researcher-facing outputs include methodological caveats and assumption statements
