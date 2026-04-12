import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

def test_sheet_connection():
    sheet_id = os.environ.get('VOICE_SHEET_ID')
    creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service-account.json')
    full_creds_path = os.path.join(os.path.dirname(__file__), '../../', creds_path)
    
    print(f"Testing connection to Google Sheets API...")
    print(f"Sheet ID: {sheet_id}")
    print(f"Looking for Credentials at: {full_creds_path}")
    
    if not os.path.exists(full_creds_path):
        print("\n❌ FAILED: Could not find your service-account.json file!")
        print("Please drag the JSON file you downloaded into the root guided-growth-mvp folder")
        print("and make sure it is named exactly 'service-account.json'")
        return
        
    try:
        creds = service_account.Credentials.from_service_account_file(
            full_creds_path, 
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()
        
        # Pull just the title of the spreadsheet to verify
        result = sheet.get(spreadsheetId=sheet_id).execute()
        
        print("\n✅ SUCCESS: Connected to Google Sheets API!")
        print(f"Spreadsheet Title: {result.get('properties', {}).get('title')}")
        print("Task 6 API Verification Complete. Your credentials are valid.")
        
    except Exception as e:
        print(f"\n❌ FAILED: Could not authenticate or read sheet.")
        print(f"Error: {e}")

if __name__ == '__main__':
    test_sheet_connection()
