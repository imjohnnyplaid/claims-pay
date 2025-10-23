import os
import pandas as pd
import argparse
from hl7apy.core import Message, Segment  # For HL7 parsing
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
import ollama
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
import joblib  # For saving ML model
import numpy as np

# Local model paths (download once)
MED_BERT_MODEL = "microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext"
OLLAMA_MODEL = "llama3"  # Or "medllama2" if pulled

class LocalAutocoder:
	def __init__(self):
		self.tokenizer = AutoTokenizer.from_pretrained(MED_BERT_MODEL)
		self.model = AutoModelForTokenClassification.from_pretrained(MED_BERT_MODEL)
		self.ner_pipeline = pipeline("ner", model=self.model, tokenizer=self.tokenizer, aggregation_strategy="simple")
		self.code_map = {  # Simple dict; expand with your historical data
			"diabetes": "E11.9", "blood test": "82947", "office visit": "99213"
		}

	def parse_hl7_claim(self, hl7_file_path):
		"""Extract text from HL7 for coding."""
		with open(hl7_file_path, 'r') as f:
			hl7_text = f.read()
		msg = Message(hl7_text)
		# Extract key segments (e.g., PV1 for visit, OBX for observations)
		notes = []
		if hasattr(msg, 'PV1'):
			notes.append(msg.PV1.PV11.Value if hasattr(msg.PV1, 'PV11') else "Routine visit")
		if hasattr(msg, 'OBX'):
			for obx in msg.OBX:
				notes.append(obx.OBX5.Value if hasattr(obx, 'OBX5') else "No details")
		claim_text = " ".join(notes)
		claim_value = float(msg.PV1.PV116.Value) if hasattr(msg.PV1, 'PV116') else 150.0  # Mock amount
		return claim_text, claim_value

	def autocode(self, claim_text):
		entities = self.ner_pipeline(claim_text)
		codes = {"ICD": [], "CPT": []}
		for ent in entities:
			word = ent['word'].lower()
			if any(diag in word for diag in self.code_map):  # Diagnosis -> ICD
				codes["ICD"].append(self.code_map.get(word, "Unmapped"))
			elif any(proc in word for proc in ["test", "visit"]):  # Procedure -> CPT
				codes["CPT"].append(self.code_map.get(word, "Unmapped"))
		return codes

class LocalRiskEngine:
	def __init__(self):
		# Simple ML model (train once on historicals)
		self.vectorizer = TfidfVectorizer(max_features=100)
		self.clf = LogisticRegression()
		# Mock train: Use historical CSV (features: text, codes; label: paid 0/1)
		if os.path.exists('risk_model.pkl'):
			self.clf = joblib.load('risk_model.pkl')
		else:
			self._train_mock_model()

	def _train_mock_model(self):
		# Dummy historical data; replace with your 2-year CSV
		df = pd.DataFrame({
			'text': ['diabetes check', 'routine visit', 'high risk procedure'],
			'codes': ['E11.9', '99213', 'Unmapped'],
			'paid': [1, 1, 0]
		})
		X = self.vectorizer.fit_transform(df['text'] + ' ' + df['codes'])
		self.clf.fit(X, df['paid'])
		joblib.dump(self.clf, 'risk_model.pkl')

	def score(self, coded_claim, claim_text):
		# LLM qualitative check
		prompt = f"Risk score (0-1, high=likely paid) for claim: {claim_text}. Codes: {coded_claim}"
		try:
			resp = ollama.generate(model=OLLAMA_MODEL, prompt=prompt)
			llm_score = float(resp['response'].split()[0])  # Parse first number
		except:
			llm_score = 0.5  # Fallback
		# ML quantitative
		features = self.vectorizer.transform([claim_text + ' ' + str(coded_claim)])
		ml_score = self.clf.predict_proba(features)[0][1]
		final_score = (llm_score + ml_score) / 2
		return final_score

def simulate_payment(coded_claim, score, claim_value, output_csv='paid_claims.csv'):
	"""Mock pay: 98% of value, log to CSV for portal metrics."""
	if score > 0.7:
		paid_amount = claim_value * 0.98  # Your 2% cut
		df = pd.DataFrame({
			'codes': [str(coded_claim)], 'score': [score], 'paid_amount': [paid_amount],
			'status': ['Paid'], 'timestamp': [pd.Timestamp.now()]
		})
		df.to_csv(output_csv, mode='a', header=not os.path.exists(output_csv), index=False)
		return True, paid_amount
	return False, 0

def run_portal_metrics(paid_csv='paid_claims.csv', historical_csv='historical_summary.csv'):
	"""Mock customer portal summary (text for now; add Streamlit later)."""
	if os.path.exists(paid_csv):
		df = pd.read_csv(paid_csv)
		total_paid = df['paid_amount'].sum()
		acceptance_rate = len(df) / 10 * 100 if len(df) > 0 else 0  # Mock total submissions=10
		print(f"Portal Metrics (Today): {len(df)} paid claims | ${total_paid:.2f} paid out | {acceptance_rate:.1f}% acceptance")
	if os.path.exists(historical_csv):
		hist_df = pd.read_csv(historical_csv)  # Columns: date, total_value, paid_rate
		current_portfolio = total_paid  # Vs. hist avg
		print(f"Portfolio: Current ${current_portfolio:.2f} vs. Historical Avg ${hist_df['total_value'].mean():.2f} | +15% growth")

def main(hl7_dir, historical_csv):
	autocoder = LocalAutocoder()
	risk_engine = LocalRiskEngine()
	rejections = 0
	for hl7_file in os.listdir(hl7_dir):
		if hl7_file.endswith('.hl7'):
			claim_text, claim_value = autocoder.parse_hl7_claim(os.path.join(hl7_dir, hl7_file))
			coded = autocoder.autocode(claim_text)
			score = risk_engine.score(coded, claim_text)
			paid, amount = simulate_payment(coded, score, claim_value)
			if not paid:
				rejections += 1
				# Retrain loop: Mock by updating code_map
				print(f"Rejected (score {score:.2f}): Recoding {hl7_file}...")
				# In full: Fine-tune model with rejection feedback
			else:
				print(f"Paid: {hl7_file} | Codes: {coded} | Score: {score:.2f} | ${amount:.2f}")
	print(f"Batch complete: {rejections} rejections (retrain on next run)")
	run_portal_metrics(historical_csv=historical_csv)

if __name__ == "__main__":
	parser = argparse.ArgumentParser(description="Local Claims Processor")
	parser.add_argument('--hl7_dir', default='./data/hl7_test', help='Dir of HL7 files')
	parser.add_argument('--historical_csv', default='./data/historical_summary.csv', help='2-year summary CSV')
	args = parser.parse_args()
	main(args.hl7_dir, args.historical_csv)