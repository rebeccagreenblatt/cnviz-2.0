#!/usr/bin/env python3
"""Generate CNViz's synthetic demo data (frontend/public/demo/): a classic GBM case and five run controls.

Everything is simulated: no real sample, patient or cell-line data is used. Fixed random seeds make the output
identical on every run, so anyone can check that the published demo files came from this script:

    python3 frontend/scripts/generate_demo_data.py              # rewrite frontend/public/demo/
    python3 frontend/scripts/generate_demo_data.py OUT_DIR      # write to OUT_DIR instead, e.g. to compare

Case (seed 42): demo_gbm.cnr / .cns (EGFR amplification, chr7 gain, chr10 loss, CDKN2A deletion, ...),
demo_gbm_baf.maf (allele counts for the BAF plot) and demo_gbm_variants.maf (TERT promoter, TP53).
Controls (seed 99): demo_control_1-5.cns, normal samples with log2 ~ N(0, 0.15) per segment.
Standard library only.
"""

import random
import csv
import os

random.seed(42)

import sys

OUTPUT_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "demo")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── hg38 chromosome sizes ──
CHR_SIZES = {
    "chr1": 248956422, "chr2": 242193529, "chr3": 198295559, "chr4": 190214555,
    "chr5": 181538259, "chr6": 170805979, "chr7": 159345973, "chr8": 145138636,
    "chr9": 138394717, "chr10": 133797422, "chr11": 135086622, "chr12": 133275309,
    "chr13": 114364328, "chr14": 107043718, "chr15": 101991189, "chr16": 90338345,
    "chr17": 83257441, "chr18": 80373285, "chr19": 58617616, "chr20": 64444167,
    "chr21": 46709983, "chr22": 50818468, "chrX": 156040895,
}

# ── Panel gene coordinates (hg38 approximate) ──
# Format: gene -> (chr, start, end)
PANEL_GENES = {
    "ABL1": ("chr9", 130713016, 130887675),
    "ACVR1": ("chr2", 157736198, 157836810),
    "ANKRD26": ("chr10", 26403542, 26501059),
    "AKT1": ("chr14", 104769349, 104795748),
    "AKT2": ("chr19", 40230317, 40285586),
    "AKT3": ("chr1", 243488089, 243807862),
    "ALK": ("chr2", 29192774, 29921566),
    "APC": ("chr5", 112707498, 112846239),
    "AR": ("chrX", 67544021, 67730619),
    "ARAF": ("chrX", 47561765, 47573607),
    "ARID1A": ("chr1", 26696014, 26782105),
    "ARID2": ("chr12", 45726759, 45867817),
    "ATM": ("chr11", 108222484, 108369102),
    "ATRX": ("chrX", 77504878, 77786236),
    "AURKA": ("chr20", 56369389, 56390455),
    "AXIN1": ("chr16", 337440, 402644),
    "B2M": ("chr15", 44711477, 44718877),
    "BAP1": ("chr3", 52435020, 52444121),
    "BARD1": ("chr2", 214809437, 214894402),
    "BCL2": ("chr18", 63123346, 63320128),
    "BRAF": ("chr7", 140719327, 140924929),
    "BRCA1": ("chr17", 43044295, 43125364),
    "BRCA2": ("chr13", 32315474, 32400266),
    "BRIP1": ("chr17", 61679185, 61863558),
    "BTK": ("chrX", 101349447, 101390796),
    "CCND1": ("chr11", 69455855, 69469242),
    "CCND2": ("chr12", 4273762, 4305233),
    "CCND3": ("chr6", 41903545, 42019379),
    "CCNE1": ("chr19", 29811195, 29824061),
    "CDH1": ("chr16", 68737292, 68835537),
    "CDK4": ("chr12", 57747727, 57752447),
    "CDK6": ("chr7", 92234235, 92465942),
    "CDKN2A": ("chr9", 21967751, 22009312),
    "CDKN2B": ("chr9", 22002902, 22009312),
    "CEBPA": ("chr19", 33299934, 33302564),
    "CHEK2": ("chr22", 28687743, 28742422),
    "CIC": ("chr19", 42271896, 42298572),
    "CREBBP": ("chr16", 3725054, 3880711),
    "CRKL": ("chr22", 20920668, 20952570),
    "CSF1R": ("chr5", 149432854, 149492935),
    "CTNNB1": ("chr3", 41194741, 41260096),
    "DAXX": ("chr6", 33286336, 33290793),
    "DDR2": ("chr1", 162601025, 162757041),
    "DDX41": ("chr5", 176936585, 176957815),
    "DICER1": ("chr14", 95086227, 95158010),
    "DNMT3A": ("chr2", 25455830, 25565459),
    "EGFR": ("chr7", 55019017, 55211628),
    "EIF1AX": ("chrX", 20126508, 20149887),
    "EP300": ("chr22", 41092592, 41180077),
    "EPAS1": ("chr2", 46297402, 46386703),
    "EPCAM": ("chr2", 47369084, 47387752),
    "EPHA3": ("chr3", 89172800, 89531829),
    "ERBB2": ("chr17", 39687914, 39730426),
    "ERBB3": ("chr12", 56081888, 56106875),
    "ERBB4": ("chr2", 211560912, 212246817),
    "ERCC2": ("chr19", 45349025, 45378502),
    "ERG": ("chr21", 38380027, 38678750),
    "ESR1": ("chr6", 151656691, 152129619),
    "ESR2": ("chr14", 64227039, 64340958),
    "ETV6": ("chr12", 11649617, 11895378),
    "EZH2": ("chr7", 148504464, 148581441),
    "FH": ("chr1", 241497719, 241520684),
    "FLCN": ("chr17", 17115527, 17140509),
    "FOLR1": ("chr11", 72148928, 72155458),
    "FBXW7": ("chr4", 152326044, 152558459),
    "FGF3": ("chr11", 69625677, 69634976),
    "FGFR1": ("chr8", 38411138, 38468834),
    "FGFR2": ("chr10", 121478332, 121598458),
    "FGFR3": ("chr4", 1793293, 1808872),
    "FGFR4": ("chr5", 177086872, 177098166),
    "FLT3": ("chr13", 28003274, 28100592),
    "FOXL2": ("chr3", 138944203, 138947539),
    "FUBP1": ("chr1", 77913792, 77951073),
    "GATA2": ("chr3", 128198264, 128212030),
    "GATA3": ("chr10", 8045378, 8075198),
    "GNA11": ("chr19", 3094414, 3112862),
    "GNAQ": ("chr9", 77716097, 77912447),
    "GNAS": ("chr20", 58839718, 58911192),
    "H1-2": ("chr6", 26056484, 26057328),
    "H1-4": ("chr6", 26027898, 26028769),
    "H3-3A": ("chr1", 226061832, 226072133),
    "H3C2": ("chr6", 26020714, 26021126),
    "H3C3": ("chr6", 26031135, 26031590),
    "HNF1A": ("chr12", 120978542, 121002512),
    "HRAS": ("chr11", 532242, 535550),
    "IDH1": ("chr2", 208236227, 208255071),
    "IDH2": ("chr15", 90083044, 90102547),
    "IGF1R": ("chr15", 98648694, 98964192),
    "IKZF1": ("chr7", 50304716, 50405101),
    "JAK1": ("chr1", 64833237, 64966620),
    "JAK2": ("chr9", 4985245, 5128183),
    "JAK3": ("chr19", 17824781, 17848051),
    "KDM5A": ("chr12", 241510, 334774),
    "KDM5C": ("chrX", 53220503, 53254604),
    "KDM6A": ("chrX", 44732423, 44971845),
    "KDR": ("chr4", 55078808, 55125595),
    "KIT": ("chr4", 54657918, 54740715),
    "KMT2C": ("chr7", 152134865, 152436486),
    "KMT2D": ("chr12", 49018318, 49056561),
    "KRAS": ("chr12", 25205246, 25250936),
    "LZTR1": ("chr22", 19710534, 19725890),
    "MAP2K1": ("chr15", 66386912, 66491573),
    "MAP2K2": ("chr19", 4090347, 4124268),
    "MAP2K4": ("chr17", 12014975, 12133586),
    "MAPK1": ("chr22", 21754500, 21867680),
    "MAPK3": ("chr16", 30114105, 30123655),
    "MAX": ("chr14", 65063490, 65087270),
    "MCL1": ("chr1", 150547027, 150552210),
    "MDM2": ("chr12", 68808172, 68850686),
    "MDM4": ("chr1", 204485509, 204527248),
    "MED12": ("chrX", 71069877, 71094589),
    "MEN1": ("chr11", 64572516, 64578766),
    "MET": ("chr7", 116672196, 116798386),
    "MITF": ("chr3", 69739543, 69968375),
    "MLH1": ("chr3", 36993332, 37050845),
    "MLH3": ("chr14", 75004888, 75042562),
    "MPL": ("chr1", 43337490, 43352963),
    "MRE11": ("chr11", 94415672, 94490839),
    "MSH2": ("chr2", 47403067, 47709820),
    "MSH3": ("chr5", 80654584, 80876363),
    "MSH6": ("chr2", 47695530, 47709820),
    "MTAP": ("chr9", 21802636, 21941099),
    "MTOR": ("chr1", 11106535, 11262507),
    "MUTYH": ("chr1", 45329163, 45340560),
    "MYB": ("chr6", 135181131, 135218855),
    "MYC": ("chr8", 127735434, 127742951),
    "MYCN": ("chr2", 15940382, 15947037),
    "NBN": ("chr8", 89933330, 89984741),
    "NF1": ("chr17", 31094927, 31377677),
    "NF2": ("chr22", 29603556, 29698600),
    "NKX2-1": ("chr14", 36516473, 36522603),
    "NOTCH1": ("chr9", 136494433, 136546048),
    "NOTCH2": ("chr1", 119911553, 120069544),
    "NOTCH3": ("chr19", 15159038, 15200995),
    "NPM1": ("chr5", 171387119, 171411136),
    "NRAS": ("chr1", 114704469, 114716894),
    "NTRK1": ("chr1", 156815751, 156881850),
    "NTRK2": ("chr9", 84668253, 85026365),
    "NTRK3": ("chr15", 87859766, 88258764),
    "PAK1": ("chr11", 77330285, 77501792),
    "PALB2": ("chr16", 23603166, 23641310),
    "PBRM1": ("chr3", 52579368, 52713739),
    "PDGFRA": ("chr4", 54229097, 54298245),
    "PDGFRB": ("chr5", 149493401, 149535375),
    "PIK3CA": ("chr3", 179148114, 179240093),
    "PIK3CB": ("chr3", 138373427, 138496654),
    "PIK3R1": ("chr5", 68215769, 68301821),
    "PMS1": ("chr2", 189820090, 189922245),
    "PMS2": ("chr7", 5970925, 6009108),
    "POLD1": ("chr19", 50384236, 50418018),
    "POLE": ("chr12", 132623666, 132687362),
    "POT1": ("chr7", 124822041, 124929093),
    "PPM1D": ("chr17", 60599880, 60654875),
    "PRPF8": ("chr17", 1553924, 1588116),
    "PRKCA": ("chr17", 66301778, 66814212),
    "PTCH1": ("chr9", 95473084, 95571200),
    "PTEN": ("chr10", 87862625, 87971930),
    "PTPN11": ("chr12", 112418946, 112509918),
    "RAB35": ("chr12", 56094145, 56107432),
    "RAC1": ("chr7", 6412377, 6442067),
    "RAD50": ("chr5", 132556328, 132649672),
    "RAD51": ("chr15", 40694774, 40732340),
    "RAD51B": ("chr14", 68286908, 68759642),
    "RAD51C": ("chr17", 58691806, 58736581),
    "RAD51D": ("chr17", 35098285, 35116847),
    "RAF1": ("chr3", 12583601, 12664098),
    "RB1": ("chr13", 48303747, 48481890),
    "RET": ("chr10", 43077027, 43130351),
    "RHOA": ("chr3", 49396579, 49449907),
    "RNF43": ("chr17", 58355879, 58418694),
    "ROS1": ("chr6", 117289181, 117425752),
    "RTEL1": ("chr20", 62892510, 62931781),
    "RUNX1": ("chr21", 34787801, 36004667),
    "SAMD9": ("chr7", 93091751, 93098951),
    "SAMD9L": ("chr7", 93113266, 93127949),
    "SDHA": ("chr5", 218360, 256814),
    "SDHAF2": ("chr11", 61374001, 61395519),
    "SDHB": ("chr1", 17345216, 17380577),
    "SDHC": ("chr1", 161284276, 161339437),
    "SDHD": ("chr11", 112086872, 112097295),
    "SETD2": ("chr3", 47016497, 47164517),
    "SF3B1": ("chr2", 197389784, 197435093),
    "SLIT2": ("chr4", 20252936, 20623979),
    "SMAD2": ("chr18", 47808957, 47931143),
    "SMAD3": ("chr15", 67063764, 67195196),
    "SMAD4": ("chr18", 51028394, 51085042),
    "SMARCA4": ("chr19", 11071715, 11182519),
    "SMARCB1": ("chr22", 23786966, 23837689),
    "SMO": ("chr7", 129188482, 129213545),
    "SPOP": ("chr17", 49619618, 49722424),
    "SRC": ("chr20", 37344685, 37407013),
    "STAG2": ("chrX", 124030538, 124187753),
    "STK11": ("chr19", 1205798, 1228434),
    "SUFU": ("chr10", 102882046, 102983786),
    "SUZ12": ("chr17", 32039457, 32106380),
    "SYK": ("chr9", 90808581, 90913791),
    "TERT": ("chr5", 1253167, 1295162),
    "TET2": ("chr4", 105145461, 105277551),
    "TGFBR2": ("chr3", 30606560, 30694142),
    "TMEM127": ("chr2", 96754857, 96772958),
    "TP53": ("chr17", 7668402, 7687550),
    "TRAF7": ("chr16", 2171780, 2199723),
    "TSC1": ("chr9", 132891349, 132945370),
    "TSC2": ("chr16", 2047990, 2089491),
    "TSHR": ("chr14", 80962485, 81152243),
    "U2AF1": ("chr21", 43092956, 43107570),
    "UBA1": ("chrX", 47190816, 47214189),
    "VHL": ("chr3", 10141788, 10153667),
    "WT1": ("chr11", 32387775, 32435260),
    "XRCC2": ("chr7", 152642920, 152670689),
    "YAP1": ("chr11", 101972855, 102076605),
}

# ── Some non-panel "filler" genes for background probes ──
# These provide coverage across all chromosomes
FILLER_GENES = {
    "PARK2": ("chr6", 161347419, 162727766),
    "DMD": ("chrX", 31097677, 33339609),
    "WWOX": ("chr16", 78133310, 79246564),
    "FHIT": ("chr3", 59747276, 61251459),
    "MACROD2": ("chr20", 13974078, 16159459),
    "RBFOX1": ("chr16", 5289788, 7763340),
    "PTPRD": ("chr9", 8314246, 10612723),
    "CSMD1": ("chr8", 2792875, 4852328),
    "CNTNAP2": ("chr7", 146116002, 148420998),
    "NRXN1": ("chr2", 49918740, 51061963),
    "LRP1B": ("chr2", 140187195, 142689327),
    "DLG2": ("chr11", 83160378, 85341594),
    "CTNNA2": ("chr2", 79625776, 80832877),
    "MAGI2": ("chr7", 77646373, 79083792),
    "GALNT13": ("chr2", 154215427, 155476598),
    "PDE4D": ("chr5", 59162188, 60552061),
    "LSAMP": ("chr3", 115297069, 116471786),
    "GPC5": ("chr13", 91485660, 92872024),
    "GPC6": ("chr13", 93226544, 94761728),
    "OPCML": ("chr11", 132788375, 133892565),
    "SGCZ": ("chr8", 13602825, 15081605),
    "PCDH15": ("chr10", 54084801, 55674085),
    "CDH13": ("chr16", 82660715, 83830696),
    "DPP10": ("chr2", 114197623, 115734459),
    "IL1RAPL1": ("chrX", 28513937, 29929091),
    "ANKS1B": ("chr12", 99024610, 99660023),
    "NEGR1": ("chr1", 71575334, 72748096),
    "SDK1": ("chr7", 3371887, 4879632),
    "CDH4": ("chr20", 60460580, 61106425),
    "DACH1": ("chr13", 71410969, 72228107),
    "SLC4A10": ("chr2", 162264553, 162733037),
    "TMEM132D": ("chr12", 127752060, 128378693),
    "GRID2": ("chr4", 93002087, 94615970),
    "CADM2": ("chr3", 85043969, 86283230),
    "DAB1": ("chr1", 57201035, 58614252),
    "PRKG1": ("chr10", 51284888, 52626321),
    "EBF1": ("chr5", 158526285, 158948656),
    "CACNA2D3": ("chr3", 54120365, 55020050),
    "RORA": ("chr15", 60490429, 61480888),
    "FOXP1": ("chr3", 70954709, 71583997),
    "SOX5": ("chr12", 23481980, 24638825),
    "ANKS1A": ("chr6", 34802505, 35080700),
    "SPAG16": ("chr2", 213180297, 213449263),
    "SEMA3A": ("chr7", 83907676, 84261816),
    "NLGN1": ("chr3", 173429636, 174270905),
    "ERBB4_fill": ("chr2", 211560912, 212246817),  # same region, different name for filler
    "TENM3": ("chr4", 182562614, 183539985),
    "SORCS1": ("chr10", 106004795, 106826337),
    "KCNMA1": ("chr10", 77449789, 78227012),
}

# ── Centromere positions (approximate, hg38) ──
CENTROMERES = {
    "chr1": (122026460, 124932724), "chr2": (92188146, 94090557),
    "chr3": (90772459, 93655574), "chr4": (49712061, 51743951),
    "chr5": (46485901, 50059807), "chr6": (58553889, 59829934),
    "chr7": (58169654, 60828234), "chr8": (44033745, 45338531),
    "chr9": (43389635, 45518558), "chr10": (39686683, 41593521),
    "chr11": (51078349, 54425074), "chr12": (34769408, 37185252),
    "chr13": (16000001, 18051248), "chr14": (16000001, 18173523),
    "chr15": (17083674, 19725254), "chr16": (36311159, 38265669),
    "chr17": (22813680, 26885980), "chr18": (15460900, 20861206),
    "chr19": (24498981, 27190874), "chr20": (26436233, 30038348),
    "chr21": (10864561, 12915808), "chr22": (12954789, 15054318),
    "chrX": (58605580, 62412542),
}

# ── EGFR amplicon ──
EGFR_START = 55019017
EGFR_END = 55211628

# CDKN2A/B/MTAP deletion region (MTAP starts at ~21802636)
CDKN2A_START = 21802636
CDKN2A_END = 22009312

# ── Helper functions ──

def noise(base, spread=0.1):
    return base + random.gauss(0, spread)

def get_log2_for_position(chrom, pos):
    """Return the expected log2 ratio for a genomic position."""
    # EGFR amplicon (focal, on chr7)
    if chrom == "chr7" and EGFR_START <= pos <= EGFR_END:
        return noise(5.6, 0.3)
    # Chromosome 7 gain
    if chrom == "chr7":
        return noise(0.5, 0.15)
    # CDKN2A/B/MTAP homozygous deletion (chr9)
    if chrom == "chr9" and CDKN2A_START - 50000 <= pos <= CDKN2A_END + 50000:
        return noise(-3.5, 0.3)
    # Chromosome 10 loss
    if chrom == "chr10":
        return noise(-0.9, 0.15)
    # Diploid
    return noise(0.0, 0.15)

def get_depth_for_log2(log2_val):
    """Approximate depth based on copy number."""
    base_depth = 300
    copies = 2 * (2 ** log2_val)
    depth = int(base_depth * copies / 2)
    depth = max(10, depth + random.randint(-30, 30))
    return depth

def get_baf_for_chrom(chrom, pos):
    """Return BAF value for a genomic position."""
    # EGFR amplicon on chr7 - extreme imbalance
    if chrom == "chr7" and EGFR_START <= pos <= EGFR_END:
        if random.random() < 0.5:
            return noise(0.95, 0.04)
        return noise(0.05, 0.04)
    # Chr7 gain (3 copies: AAB/ABB pattern)
    if chrom == "chr7":
        r = random.random()
        if r < 0.15:
            return noise(0.0, 0.03)   # homozygous AAA
        elif r < 0.30:
            return noise(1.0, 0.03)   # homozygous BBB
        elif r < 0.65:
            return noise(0.33, 0.06)  # het AAB
        else:
            return noise(0.67, 0.06)  # het ABB
    # Chr10 loss (LOH)
    if chrom == "chr10":
        if random.random() < 0.5:
            return noise(0.95, 0.05)
        return noise(0.05, 0.05)
    # Diploid
    return noise(0.5, 0.08)


def generate_probes_for_gene(gene, chrom, start, end, n_probes):
    """Generate evenly-spaced probes across a gene."""
    probes = []
    length = end - start
    if n_probes <= 1:
        pos = start + length // 2
        log2 = get_log2_for_position(chrom, pos)
        depth = get_depth_for_log2(log2)
        w = round(random.uniform(0.7, 1.0), 4)
        probes.append((chrom, pos, pos + 500, gene, round(log2, 4), depth, w))
    else:
        step = length // n_probes
        for i in range(n_probes):
            pos = start + i * step + random.randint(0, max(1, step // 3))
            pos = min(pos, end - 500)
            log2 = get_log2_for_position(chrom, pos)
            depth = get_depth_for_log2(log2)
            w = round(random.uniform(0.7, 1.0), 4)
            probes.append((chrom, pos, pos + 500, gene, round(log2, 4), depth, w))
    return probes


def generate_background_probes(chrom, chr_size, existing_positions):
    """Generate background (intergenic/antitarget) probes across a chromosome."""
    probes = []
    cent = CENTROMERES.get(chrom, (chr_size // 2, chr_size // 2 + 1000000))
    # Generate probes every ~2Mb for background
    step = 2_000_000
    pos = 1_000_000
    while pos < chr_size - 500:
        # Skip centromere
        if cent[0] - 500000 <= pos <= cent[1] + 500000:
            pos += step
            continue
        # Skip if too close to an existing probe
        too_close = False
        for ep in existing_positions:
            if abs(pos - ep) < 10000:
                too_close = True
                break
        if not too_close:
            log2 = get_log2_for_position(chrom, pos)
            depth = get_depth_for_log2(log2)
            # Lower weight for antitarget probes
            w = round(random.uniform(0.3, 0.6), 4)
            probes.append((chrom, pos, pos + 5000, "-", round(log2, 4), depth, w))
        pos += step
    return probes


# ============================================================
# GENERATE .cnr FILE
# ============================================================
print("Generating .cnr file...")
all_probes = []

# Panel genes: 20-50 probes each
for gene, (chrom, start, end) in PANEL_GENES.items():
    n = random.randint(20, 50)
    probes = generate_probes_for_gene(gene, chrom, start, end, n)
    all_probes.extend(probes)

# Filler genes: 1-2 probes each
for gene, (chrom, start, end) in FILLER_GENES.items():
    n = random.randint(1, 2)
    probes = generate_probes_for_gene(gene, chrom, start, end, n)
    all_probes.extend(probes)

# Background probes across all chromosomes
for chrom in CHR_SIZES:
    existing = [p[1] for p in all_probes if p[0] == chrom]
    bg = generate_background_probes(chrom, CHR_SIZES[chrom], existing)
    all_probes.extend(bg)

# Sort by chromosome and position
chrom_order = list(CHR_SIZES.keys())
all_probes.sort(key=lambda p: (chrom_order.index(p[0]), p[1]))

cnr_path = os.path.join(OUTPUT_DIR, "demo_gbm.cnr")
with open(cnr_path, "w", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["chromosome", "start", "end", "gene", "log2", "depth", "weight"])
    for p in all_probes:
        w.writerow(p)

print(f"  -> {cnr_path} ({len(all_probes)} probes)")

# ============================================================
# GENERATE .cns FILE (segments)
# ============================================================
print("Generating .cns file...")

segments = []

for chrom in chrom_order:
    chr_size = CHR_SIZES[chrom]
    cent = CENTROMERES.get(chrom, (chr_size // 2, chr_size // 2 + 1000000))

    chr_probes = [p for p in all_probes if p[0] == chrom]

    if chrom == "chr7":
        # Three segments: pre-EGFR, EGFR amplicon, post-EGFR
        seg_probes = [p for p in chr_probes if p[1] < EGFR_START]
        if seg_probes:
            genes = list(set(p[3] for p in seg_probes if p[3] != "-"))
            log2_vals = [p[4] for p in seg_probes]
            avg_log2 = round(sum(log2_vals) / len(log2_vals), 4)
            avg_depth = int(sum(p[5] for p in seg_probes) / len(seg_probes))
            segments.append((chrom, seg_probes[0][1], EGFR_START - 1,
                             ",".join(sorted(genes)[:10]) if genes else "-",
                             avg_log2, avg_depth, len(seg_probes), 0.9))

        # EGFR amplicon
        seg_probes = [p for p in chr_probes if EGFR_START <= p[1] <= EGFR_END]
        if seg_probes:
            log2_vals = [p[4] for p in seg_probes]
            avg_log2 = round(sum(log2_vals) / len(log2_vals), 4)
            avg_depth = int(sum(p[5] for p in seg_probes) / len(seg_probes))
            segments.append((chrom, EGFR_START, EGFR_END,
                             "EGFR", avg_log2, avg_depth, len(seg_probes), 0.95))

        # Post-EGFR to end
        seg_probes = [p for p in chr_probes if p[1] > EGFR_END]
        if seg_probes:
            genes = list(set(p[3] for p in seg_probes if p[3] != "-"))
            log2_vals = [p[4] for p in seg_probes]
            avg_log2 = round(sum(log2_vals) / len(log2_vals), 4)
            avg_depth = int(sum(p[5] for p in seg_probes) / len(seg_probes))
            segments.append((chrom, EGFR_END + 1, chr_size,
                             ",".join(sorted(genes)[:10]) if genes else "-",
                             avg_log2, avg_depth, len(seg_probes), 0.9))

    elif chrom == "chr9":
        # Split around CDKN2A deletion
        pre = [p for p in chr_probes if p[1] < CDKN2A_START - 50000]
        deletion = [p for p in chr_probes if CDKN2A_START - 50000 <= p[1] <= CDKN2A_END + 50000]
        post = [p for p in chr_probes if p[1] > CDKN2A_END + 50000]

        for seg_probes, start, end in [(pre, 1000000, CDKN2A_START - 50001),
                                        (deletion, CDKN2A_START - 50000, CDKN2A_END + 50000),
                                        (post, CDKN2A_END + 50001, chr_size)]:
            if seg_probes:
                genes = list(set(p[3] for p in seg_probes if p[3] != "-"))
                log2_vals = [p[4] for p in seg_probes]
                avg_log2 = round(sum(log2_vals) / len(log2_vals), 4)
                avg_depth = int(sum(p[5] for p in seg_probes) / len(seg_probes))
                segments.append((chrom, start, end,
                                 ",".join(sorted(genes)[:10]) if genes else "-",
                                 avg_log2, avg_depth, len(seg_probes),
                                 0.95 if deletion == seg_probes else 0.9))

    elif chrom == "chr10":
        # Whole chromosome loss - single segment
        if chr_probes:
            genes = list(set(p[3] for p in chr_probes if p[3] != "-"))
            log2_vals = [p[4] for p in chr_probes]
            avg_log2 = round(sum(log2_vals) / len(log2_vals), 4)
            avg_depth = int(sum(p[5] for p in chr_probes) / len(chr_probes))
            segments.append((chrom, chr_probes[0][1], chr_size,
                             ",".join(sorted(genes)[:10]) if genes else "-",
                             avg_log2, avg_depth, len(chr_probes), 0.9))

    else:
        # Diploid chromosome - 1-3 segments
        if chr_probes:
            # Split into p-arm and q-arm at centromere
            p_arm = [p for p in chr_probes if p[1] < cent[0]]
            q_arm = [p for p in chr_probes if p[1] > cent[1]]

            for seg_probes in [p_arm, q_arm]:
                if seg_probes:
                    genes = list(set(p[3] for p in seg_probes if p[3] != "-"))
                    log2_vals = [p[4] for p in seg_probes]
                    avg_log2 = round(sum(log2_vals) / len(log2_vals), 4)
                    avg_depth = int(sum(p[5] for p in seg_probes) / len(seg_probes))
                    segments.append((chrom, seg_probes[0][1], seg_probes[-1][2],
                                     ",".join(sorted(genes)[:10]) if genes else "-",
                                     avg_log2, avg_depth, len(seg_probes), 0.9))

segments.sort(key=lambda s: (chrom_order.index(s[0]), s[1]))

cns_path = os.path.join(OUTPUT_DIR, "demo_gbm.cns")
with open(cns_path, "w", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["chromosome", "start", "end", "gene", "log2", "depth", "probes", "weight"])
    for s in segments:
        w.writerow(s)

print(f"  -> {cns_path} ({len(segments)} segments)")

# ============================================================
# GENERATE BAF .maf FILE
# ============================================================
print("Generating BAF .maf file...")

baf_rows = []
snp_id = 0

for chrom in chrom_order:
    chr_size = CHR_SIZES[chrom]
    cent = CENTROMERES.get(chrom, (chr_size // 2, chr_size // 2 + 1000000))

    # ~1 SNP every 300kb on average
    step = 300_000
    pos = random.randint(10000, 50000)

    while pos < chr_size - 1000:
        # Skip centromere
        if cent[0] - 500000 <= pos <= cent[1] + 500000:
            pos += step + random.randint(-20000, 20000)
            continue

        baf = get_baf_for_chrom(chrom, pos)
        baf = max(0.0, min(1.0, baf))  # clamp

        total_depth = random.randint(200, 500)
        alt_count = int(round(baf * total_depth))
        ref_count = total_depth - alt_count

        snp_id += 1
        baf_rows.append(("SNP_%d" % snp_id, chrom, pos, "SNP", ref_count, alt_count))

        pos += step + random.randint(-20000, 20000)

baf_path = os.path.join(OUTPUT_DIR, "demo_gbm_baf.maf")
with open(baf_path, "w", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["Hugo_Symbol", "Chromosome", "Start_Position", "Variant_Classification",
                "t_ref_count", "t_alt_count"])
    for row in baf_rows:
        w.writerow(row)

print(f"  -> {baf_path} ({len(baf_rows)} SNPs)")

# ============================================================
# GENERATE SOMATIC VARIANTS .maf FILE
# ============================================================
print("Generating somatic variants .maf file...")

variants = [
    # Key pathogenic variants
    {
        "Hugo_Symbol": "TERT",
        "Chromosome": "chr5",
        "Start_Position": 1295228,
        "Reference_Allele": "G",
        "Tumor_Seq_Allele2": "A",
        "HGVSc": "c.-124C>T",
        "HGVSp_Short": "",
        "Variant_Classification": "5'Flank",
        "ClinVar_Significance": "Pathogenic",
        "t_ref_count": 275,
        "t_alt_count": 225,
    },
    {
        "Hugo_Symbol": "TP53",
        "Chromosome": "chr17",
        "Start_Position": 7674220,
        "Reference_Allele": "C",
        "Tumor_Seq_Allele2": "T",
        "HGVSc": "c.524G>A",
        "HGVSp_Short": "p.R175H",
        "Variant_Classification": "Missense_Mutation",
        "ClinVar_Significance": "Pathogenic",
        "t_ref_count": 208,
        "t_alt_count": 192,
    },
]

var_path = os.path.join(OUTPUT_DIR, "demo_gbm_variants.maf")
with open(var_path, "w", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["Hugo_Symbol", "Chromosome", "Start_Position", "Reference_Allele",
                "Tumor_Seq_Allele2", "HGVSc", "HGVSp_Short", "Variant_Classification",
                "ClinVar_Significance", "t_ref_count", "t_alt_count"])
    for v in variants:
        w.writerow([v["Hugo_Symbol"], v["Chromosome"], v["Start_Position"],
                     v["Reference_Allele"], v["Tumor_Seq_Allele2"], v["HGVSc"],
                     v["HGVSp_Short"], v["Variant_Classification"],
                     v["ClinVar_Significance"], v["t_ref_count"], v["t_alt_count"]])

print(f"  -> {var_path} ({len(variants)} variants)")
print("\nDone! All files generated.")


# ── Run controls: five synthetic normal samples ──
random.seed(99)  # separate seed, so the controls don't depend on the case data above

chroms = [
    ("chr1", 248956422), ("chr2", 242193529), ("chr3", 198295559),
    ("chr4", 190214555), ("chr5", 181538259), ("chr6", 170805979),
    ("chr7", 159345973), ("chr8", 145138636), ("chr9", 138394717),
    ("chr10", 133797422), ("chr11", 135086622), ("chr12", 133275309),
    ("chr13", 114364328), ("chr14", 107043718), ("chr15", 101991189),
    ("chr16", 90338345), ("chr17", 83257441), ("chr18", 80373285),
    ("chr19", 58617616), ("chr20", 64444167), ("chr21", 46709983),
    ("chr22", 50818468), ("chrX", 156040895),
]

for i in range(1, 6):
    fname = os.path.join(OUTPUT_DIR, f"demo_control_{i}.cns")
    with open(fname, "w") as f:
        f.write("chromosome\tstart\tend\tgene\tlog2\tdepth\tprobes\tweight\n")
        for chrom, size in chroms:
            n_segs = random.randint(3, 6)
            breaks = sorted(random.sample(range(1000, size - 1000), n_segs - 1))
            starts = [0] + breaks
            ends = breaks + [size]
            for s, e in zip(starts, ends):
                log2 = random.gauss(0, 0.15)
                depth = random.uniform(250, 500)
                probes = max(1, int((e - s) / 500000))
                f.write(f"{chrom}\t{s}\t{e}\t-\t{log2:.4f}\t{depth:.1f}\t{probes}\t1.0\n")
    print(f"Wrote {fname}")
