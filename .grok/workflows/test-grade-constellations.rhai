let meta = #{
    name: "test-grade-constellations",
    description: "Test all ExamGrade grading constellations and borderline thresholds via matrix runner + adversarial agents",
    when_to_use: "After changes to grades/portfolio/match/statistics or when verifying pass thresholds and Grenzfälle",
    phases: [
        #{ title: "Inventory", detail: "Map code paths to constellation matrix" },
        #{ title: "Matrix-Runner", detail: "Run deterministic tsx matrix" },
        #{ title: "Cluster-Check", detail: "Verify clusters A–E against runner + code" },
        #{ title: "Adversarial", detail: "Refute three failure claims" },
        #{ title: "Synthesize", detail: "Write report and overall verdict" },
    ],
};

let inventory_schema = #{
    "type": "object",
    "required": ["paths_ok", "notes"],
    "properties": #{
        "paths_ok": #{ "type": "boolean" },
        "notes": #{ "type": "string" },
        "missing_cases": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

let runner_schema = #{
    "type": "object",
    "required": ["exit_code", "passed", "failed", "total", "failed_ids", "stdout_tail"],
    "properties": #{
        "exit_code": #{ "type": "integer" },
        "passed": #{ "type": "integer" },
        "failed": #{ "type": "integer" },
        "total": #{ "type": "integer" },
        "failed_ids": #{ "type": "array", "items": #{ "type": "string" } },
        "stdout_tail": #{ "type": "string" },
    },
};

let cluster_schema = #{
    "type": "object",
    "required": ["cluster", "ok", "summary"],
    "properties": #{
        "cluster": #{ "type": "string" },
        "ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "issues": #{
            "type": "array",
            "items": #{
                "type": "object",
                "required": ["id", "severity", "evidence"],
                "properties": #{
                    "id": #{ "type": "string" },
                    "severity": #{ "type": "string" },
                    "evidence": #{ "type": "string" },
                },
            },
        },
    },
};

let adv_schema = #{
    "type": "object",
    "required": ["claim", "refuted", "evidence"],
    "properties": #{
        "claim": #{ "type": "string" },
        "refuted": #{ "type": "boolean" },
        "evidence": #{ "type": "string" },
    },
};

let final_schema = #{
    "type": "object",
    "required": ["overall_pass", "summary", "report_markdown"],
    "properties": #{
        "overall_pass": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "report_markdown": #{ "type": "string" },
        "failed_case_ids": #{ "type": "array", "items": #{ "type": "string" } },
        "open_bugs": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

// --- Inventory ---
phase("Inventory");
let inv_prompt = "";
inv_prompt += "You are verifying ExamGrade grading architecture (repo root is the workspace).\n";
inv_prompt += "Read with read_file/grep (read-only):\n";
inv_prompt += "- src/lib/grades/portfolio.ts (gradeFromUnitAvg, computePortfolioGradeForProject, portfolioUsesGradeScenarios)\n";
inv_prompt += "- src/lib/grades/schema.ts (calculateGrade, generateLinearGradeSchema)\n";
inv_prompt += "- src/lib/grades/statistics.ts (defaultBorderlineMax, computeStatistics)\n";
inv_prompt += "- src/lib/grades/next-grade.ts\n";
inv_prompt += "- src/lib/matching/match.ts (buildEnrichedRows, calculatedGradeForRecord)\n";
inv_prompt += "- scripts/grade-constellation-matrix.mts if present\n";
inv_prompt += "Confirm these code paths exist for: Klausur points, portfolio criteria points/percent/grade, ";
inv_prompt += "scenario-driven unitAvg->calculateGrade, linear 5-4*unit for grade scale, defaultBorderlineMax points=2 grade=0.1.\n";
inv_prompt += "Set paths_ok=true only if you read the files and the paths match. notes = short German summary. ";
inv_prompt += "missing_cases = any matrix IDs A1-A10 B1-B5 C1-C5 D1-D8 E1-E3 not covered by matrix script or code.\n";

let inv = agent(inv_prompt, #{
    label: "inventory",
    capability_mode: "read-only",
    output_schema: inventory_schema,
});
if inv == () || !inv.success {
    // log removed for host compatibility
} else {
    // log removed for host compatibility
}

// --- Matrix runner ---
phase("Matrix-Runner");
let run_prompt = "";
run_prompt += "Run the deterministic grade constellation matrix for ExamGrade.\n";
run_prompt += "1. Confirm scripts/grade-constellation-matrix.mts exists (read first lines). If missing, create it covering cases ";
run_prompt += "A1-A10, B1-B5, C1-C5, D1-D8, E1-E3 using relative imports from ../src/lib/... and buildEnrichedRows fixtures.\n";
run_prompt += "2. Execute in the repo root with shell: npx --yes tsx scripts/grade-constellation-matrix.mts\n";
run_prompt += "3. Parse the SUMMARY JSON from stdout (passed, failed, total, failedIds).\n";
run_prompt += "4. Return exit_code (0 or 1), passed, failed, total, failed_ids array, and stdout_tail (last ~40 lines).\n";
run_prompt += "Do not invent pass results — only report actual command output.\n";

let run = agent(run_prompt, #{
    label: "matrix-runner",
    capability_mode: "execute",
    output_schema: runner_schema,
});

let runner_ok = false;
let runner_passed = 0;
let runner_failed = 0;
let runner_total = 0;
let runner_failed_ids = [];
let runner_tail = "";
let runner_exit = 1;

if run != () && run.success && run.output != () {
    runner_exit = run.output.exit_code;
    runner_passed = run.output.passed;
    runner_failed = run.output.failed;
    runner_total = run.output.total;
    runner_failed_ids = run.output.failed_ids;
    runner_tail = run.output.stdout_tail;
    runner_ok = runner_exit == 0 && runner_failed == 0;
    // log removed for host compatibility
} else {
    // log removed for host compatibility
    runner_tail = "runner agent failed";
}

// --- Cluster checks (parallel) ---
phase("Cluster-Check");
let runner_json = json_encode(#{
    exit_code: runner_exit,
    passed: runner_passed,
    failed: runner_failed,
    total: runner_total,
    failed_ids: runner_failed_ids,
    stdout_tail: runner_tail,
});

let c_ab = "";
c_ab += "Cluster A+B (exam types + scenarios). Fail closed.\n";
c_ab += "Matrix runner result JSON: " + runner_json + "\n";
c_ab += "Read scripts/grade-constellation-matrix.mts and src/lib/grades/portfolio.ts + match.ts.\n";
c_ab += "Verify coverage and that runner passed A1-A10 and B1-B5 (or list failures with evidence).\n";
c_ab += "cluster='A+B'. ok=true only if runner failed_ids has none of A*/B* and code paths match.\n";
c_ab += "summary in German, max 800 chars. issues only if real problems.\n";

let c_c = "";
c_c += "Cluster C (schema edges calculateGrade). Fail closed.\n";
c_c += "Matrix result: " + runner_json + "\n";
c_c += "Read src/lib/grades/schema.ts. Confirm C1-C5 expectations (exact threshold, below, 0/max, FP epsilon, unit clamp).\n";
c_c += "cluster='C'. ok only if no C* in failed_ids.\n";

let c_d = "";
c_d += "Cluster D (Grenzfälle / next grade). Fail closed.\n";
c_d += "Matrix result: " + runner_json + "\n";
c_d += "Read src/lib/grades/statistics.ts defaultBorderlineMax and next-grade.ts.\n";
c_d += "Confirm D3 points max100=2, grade=0.1; D4 old max=1 marks all grade-units; D5 points path not all borderline.\n";
c_d += "cluster='D'. ok only if no D* failed_ids.\n";

let c_e = "";
c_e += "Cluster E (buildEnrichedRows integration). Fail closed.\n";
c_e += "Matrix result: " + runner_json + "\n";
c_e += "Read match.ts buildEnrichedRows. Confirm E1 scenario switch, E2 schema TL grades, E3 override.\n";
c_e += "cluster='E'. ok only if no E* failed_ids.\n";

let cluster_jobs = [
    #{ prompt: c_ab, label: "cluster-A-B", capability_mode: "read-only", output_schema: cluster_schema },
    #{ prompt: c_c, label: "cluster-C", capability_mode: "read-only", output_schema: cluster_schema },
    #{ prompt: c_d, label: "cluster-D", capability_mode: "read-only", output_schema: cluster_schema },
    #{ prompt: c_e, label: "cluster-E", capability_mode: "read-only", output_schema: cluster_schema },
];
let cluster_results = parallel(cluster_jobs);

let clusters_ok = true;
let cluster_notes = "";
let ci = 0;
for cr in cluster_results {
    if cr == () || !cr.success || cr.output == () {
        clusters_ok = false;
        cluster_notes += "cluster slot " + ci.to_string() + " failed; ";
    } else {
        if cr.output.ok != true {
            clusters_ok = false;
        }
        cluster_notes += cr.output.cluster + ":" + cr.output.ok.to_string() + "; ";
    }
    ci += 1;
}
// log removed for host compatibility

// --- Adversarial ---
phase("Adversarial");
let adv1 = "";
adv1 += "ADVERSARIAL CLAIM: Changing pass threshold 40%/50%/60% does NOT change portfolio grades (identical Ø Note).\n";
adv1 += "You must try to REFUTE this claim with concrete numbers from the matrix runner output and/or by reading code.\n";
adv1 += "Matrix: " + runner_json + "\n";
adv1 += "Also read scripts/grade-constellation-matrix.mts B1/B2 cases and portfolio computePortfolioGradeForProject.\n";
adv1 += "Set refuted=true ONLY with numeric evidence (e.g. different averages or grades). claim=the claim text. evidence=concrete.\n";
adv1 += "If runner failed or evidence missing, refuted=false.\n";

let adv2 = "";
adv2 += "ADVERSARIAL CLAIM: defaultBorderlineMax still marks nearly all students as Grenzfall (as with max=1 on grade units).\n";
adv2 += "Refute using D3/D4/D5 matrix results and statistics.ts. Matrix: " + runner_json + "\n";
adv2 += "refuted=true only with evidence that grade default is 0.1 and points path borderlineCount < n.\n";

let adv3 = "";
adv3 += "ADVERSARIAL CLAIM: The code confuses paths — grade-scale TLs use schema scenarios and points/percent TLs stay linear 5-4*unit.\n";
adv3 += "Refute by citing gradeFromUnitAvg and A5/A6/A7 matrix results. Matrix: " + runner_json + "\n";
adv3 += "refuted=true only if evidence shows grade-scale ignores scenario and points/percent uses calculateGrade.\n";

let adv_jobs = [
    #{ prompt: adv1, label: "adv-scenario", capability_mode: "read-only", output_schema: adv_schema },
    #{ prompt: adv2, label: "adv-borderline", capability_mode: "read-only", output_schema: adv_schema },
    #{ prompt: adv3, label: "adv-path", capability_mode: "read-only", output_schema: adv_schema },
];
let adv_results = parallel(adv_jobs);

let adv_all_refuted = true;
let adv_notes = "";
let ai = 0;
for ar in adv_results {
    if ar == () || !ar.success || ar.output == () {
        adv_all_refuted = false;
        adv_notes += "adv" + ai.to_string() + ":missing; ";
    } else {
        if ar.output.refuted != true || ar.output.evidence == () || ar.output.evidence == "" {
            adv_all_refuted = false;
        }
        adv_notes += "adv" + ai.to_string() + ":refuted=" + ar.output.refuted.to_string() + "; ";
    }
    ai += 1;
}
// log removed for host compatibility

// --- Synthesize ---
phase("Synthesize");
let overall = runner_ok && clusters_ok && adv_all_refuted;
if inv != () && inv.success && inv.output.paths_ok == false {
    overall = false;
}

let syn_prompt = "";
syn_prompt += "Write a concise German markdown report for ExamGrade grade-constellation verification.\n";
syn_prompt += "Inputs:\n";
syn_prompt += "- overall_pass should be " + overall.to_string() + " unless you find contradiction (fail closed on missing evidence).\n";
syn_prompt += "- Matrix: " + runner_json + "\n";
syn_prompt += "- Cluster notes: " + cluster_notes + "\n";
syn_prompt += "- Adversarial notes: " + adv_notes + "\n";
syn_prompt += "Include: summary table of pass/fail counts, B1 scenario averages if available in stdout_tail, Grenzfall defaults, ";
syn_prompt += "whether anti-claims were refuted, failed_case_ids, open_bugs (empty if none).\n";
syn_prompt += "report_markdown = full markdown body. summary = 2-3 sentences.\n";

let syn = agent(syn_prompt, #{
    label: "synthesize",
    capability_mode: "read-write",
    output_schema: final_schema,
});

let report_md = "# Grade constellation report\n\n(synthesis missing)\n";
let summary_txt = "Synthesis incomplete";
let final_pass = overall;
let failed_ids_out = runner_failed_ids;
let open_bugs = [];

if syn != () && syn.success && syn.output != () {
    report_md = syn.output.report_markdown;
    summary_txt = syn.output.summary;
    // Fail closed: synthesis cannot greenwash a red matrix
    if overall == false {
        final_pass = false;
    } else {
        final_pass = syn.output.overall_pass == true;
    }
    if syn.output.failed_case_ids != () {
        failed_ids_out = syn.output.failed_case_ids;
    }
    if syn.output.open_bugs != () {
        open_bugs = syn.output.open_bugs;
    }
}

report_md += "\n\n## Workflow machine verdict\n\n";
report_md += "- runner_ok: " + runner_ok.to_string() + "\n";
report_md += "- clusters_ok: " + clusters_ok.to_string() + "\n";
report_md += "- adv_all_refuted: " + adv_all_refuted.to_string() + "\n";
report_md += "- final_pass: " + final_pass.to_string() + "\n";

let report_path = write_scratch_file("grade-constellation-report.md", report_md);
// log removed for host compatibility

complete(#{
    overall_pass: final_pass,
    summary: summary_txt,
    report_path: report_path,
    runner_passed: runner_passed,
    runner_failed: runner_failed,
    runner_total: runner_total,
    failed_case_ids: failed_ids_out,
    open_bugs: open_bugs,
    clusters_ok: clusters_ok,
    adv_all_refuted: adv_all_refuted,
});

