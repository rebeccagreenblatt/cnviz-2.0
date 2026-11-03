"""Tests for cnviz_report.py. Run with:  python3 -m unittest discover report   (standard library only)

They use a tiny stand-in template, so no build is needed; the real offline file is checked by the release job.
"""
import gzip
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cnviz_report.py")
TEMPLATE = "<!doctype html><html><head><title>CNViz 9.9.9 (offline)</title></head><body><div id=\"root\"></div></body></html>"
CNS = "chromosome\tstart\tend\tgene\tlog2\tdepth\tprobes\tweight\nchr7\t0\t1000\t-\t1.2\t300\t5\t4\n"


class ReportScriptTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.template = self.path("cnviz-9.9.9.html", TEMPLATE)
        self.sha = hashlib.sha256(TEMPLATE.encode()).hexdigest()
        self.path("cnviz-9.9.9.html.sha256", f"{self.sha}  cnviz-9.9.9.html\n")
        self.cns = self.path("S1.cns", CNS)
        self.out = os.path.join(self.dir.name, "report.html")

    def tearDown(self):
        self.dir.cleanup()

    def path(self, name, text):
        p = os.path.join(self.dir.name, name)
        with open(p, "w", encoding="utf-8") as f:
            f.write(text)
        return p

    def run_script(self, *args, template=None):
        cmd = [sys.executable, SCRIPT, "--template", template or self.template, "--build", "hg38", "-o", self.out, *args]
        return subprocess.run(cmd, capture_output=True, text=True)

    def case(self):
        with open(self.out, encoding="utf-8") as f:
            html = f.read()
        block = re.search(r'<script type="application/json" id="cnviz-case">(.*?)</script>', html, re.S).group(1)
        return html, block, json.loads(block)

    # --- template check ---------------------------------------------------------------------------------------------

    def test_pinned_checksum_accepts_the_genuine_template(self):
        r = self.run_script("--cns", self.cns, "--expect-sha256", self.sha)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn("only detects", r.stderr)

    def test_pinned_checksum_refuses_a_swapped_template_even_with_a_swapped_checksum_file(self):
        tampered = TEMPLATE.replace("</body>", "<!-- tampered --></body>")
        evil = self.path("evil.html", tampered)
        self.path("evil.html.sha256", hashlib.sha256(tampered.encode()).hexdigest() + "  evil.html\n")
        r = self.run_script("--cns", self.cns, "--expect-sha256", self.sha, template=evil)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("does not match its checksum", r.stderr)
        self.assertFalse(os.path.exists(self.out))

    def test_unpinned_check_warns_that_it_only_detects_corruption(self):
        r = self.run_script("--cns", self.cns)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("only detects", r.stderr)

    def test_empty_checksum_file_is_a_clear_error(self):
        self.path("cnviz-9.9.9.html.sha256", "")
        r = self.run_script("--cns", self.cns)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("not a SHA-256 value", r.stderr)

    # --- embedded data ----------------------------------------------------------------------------------------------

    def test_file_content_cannot_affect_how_the_page_is_parsed(self):
        maf = self.path("v.maf", "Hugo_Symbol\tCLIN_SIG\nTP53\tpathogenic <!--<script>alert(1)</script> & co\n")
        r = self.run_script("--cns", self.cns, "--variants", maf, "--expect-sha256", self.sha)
        self.assertEqual(r.returncode, 0, r.stderr)
        _, block, case = self.case()
        self.assertNotRegex(block, "[<>&]")  # every <, > and & is a JSON escape
        self.assertIn("<!--<script>alert(1)</script> & co", case["files"]["variants"]["text"])  # data is intact

    def test_page_title_is_generic_and_case_details_are_inside(self):
        r = self.run_script("--cns", self.cns, "--name", "CASE-123", "--expect-sha256", self.sha)
        self.assertEqual(r.returncode, 0, r.stderr)
        html, _, case = self.case()
        self.assertIn("<title>CNViz report</title>", html)
        self.assertNotIn("CASE-123</title>", html)
        self.assertEqual(case["name"], "CASE-123")
        self.assertEqual(case["cnviz_version"], "9.9.9")

    def test_defaults_are_100_percent_purity_and_ploidy_2(self):
        self.run_script("--cns", self.cns, "--expect-sha256", self.sha)
        _, _, case = self.case()
        self.assertEqual((case["purity_pct"], case["chromosomes"]), (100, 46))
        self.assertEqual(case["name"], "S1")  # from the file name

    def test_purity_ploidy_and_gene_list_are_passed_through(self):
        genes = self.path("genes.csv", "Gene\nEGFR\nCDKN2A\n")
        r = self.run_script("--cns", self.cns, "--purity", "60", "--ploidy", "3", "--genes", genes, "--expect-sha256", self.sha)
        self.assertEqual(r.returncode, 0, r.stderr)
        _, _, case = self.case()
        self.assertEqual((case["purity_pct"], case["chromosomes"]), (60, 69))
        self.assertEqual(case["files"]["genes"]["text"], "Gene\nEGFR\nCDKN2A\n")

    def test_ploidy_that_is_not_a_whole_chromosome_count_is_rounded_with_a_note(self):
        r = self.run_script("--cns", self.cns, "--ploidy", "2.5", "--expect-sha256", self.sha)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("58 chromosomes", r.stderr)

    def test_gzipped_inputs_are_decompressed_and_named_without_gz(self):
        gz = os.path.join(self.dir.name, "S1.vcf.gz")
        with gzip.open(gz, "wt") as f:
            f.write("##fileformat=VCFv4.2\n")
        r = self.run_script("--cns", self.cns, "--baf", gz, "--expect-sha256", self.sha)
        self.assertEqual(r.returncode, 0, r.stderr)
        _, _, case = self.case()
        self.assertEqual(case["files"]["baf"], {"name": "S1.vcf", "text": "##fileformat=VCFv4.2\n"})

    # --- argument checks --------------------------------------------------------------------------------------------

    def test_requires_a_cnr_or_cns(self):
        r = self.run_script("--expect-sha256", self.sha)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("--cnr or --cns", r.stderr)

    def test_rejects_purity_outside_1_to_100(self):
        r = self.run_script("--cns", self.cns, "--purity", "0", "--expect-sha256", self.sha)
        self.assertNotEqual(r.returncode, 0)

    def test_refuses_to_use_a_report_as_a_template(self):
        self.run_script("--cns", self.cns, "--expect-sha256", self.sha)
        with open(self.out, encoding="utf-8") as f:
            report_sha = hashlib.sha256(f.read().encode()).hexdigest()
        report_as_template = self.out
        self.out = os.path.join(self.dir.name, "second.html")
        r = self.run_script("--cns", self.cns, "--expect-sha256", report_sha, template=report_as_template)
        self.assertNotEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
