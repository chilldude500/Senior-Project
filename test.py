from pymongo import MongoClient
from datetime import datetime

# Connection string to your MongoDB Atlas database
connection_string = "mongodb+srv://seniorproject:RsxK1bDyaTDoXnzx@seniorproject.wkyrwfp.mongodb.net/"

try:
    # Connect to MongoDB
    print("Connecting to MongoDB...")
    client = MongoClient(connection_string)
    
    # Use the existing sample_mflix database
    db = client['sample_mflix']
    
    # Create a new collection for testing (won't affect existing data)
    collection = db['environment_test']
    
    print("✓ Successfully connected to MongoDB!")
    print(f"Using database: sample_mflix")
    
    # ===== SAVE DATA (INSERT) =====
    print("\n--- Saving data to database ---")
    
    # Create a test document
    test_data = {
        "student_name": "David",  #
        "student_id": "027258554",
        "task": "Environment Setup - Task 4",
        "action": "Save and Retrieve Data Test",
        "timestamp": datetime.now(),
        "status": "Success"
    }
    
    # Insert the document
    result = collection.insert_one(test_data)
    print(f"✓ Data saved! Document ID: {result.inserted_id}")
    
    # RETRIEVE DATA (FIND) 
    print("\n--- Retrieving data from database ---")
    
    # Find the document we just inserted
    retrieved_data = collection.find_one({"student_id": "027258554"})
    
    print("✓ Data retrieved successfully!")
    print(f"Student Name: {retrieved_data['student_name']}")
    print(f"Student ID: {retrieved_data['student_id']}")
    print(f"Task: {retrieved_data['task']}")
    print(f"Action: {retrieved_data['action']}")
    print(f"Timestamp: {retrieved_data['timestamp']}")
    print(f"Status: {retrieved_data['status']}")
    
    # Show document count
    print(f"\n--- Total test documents in collection: {collection.count_documents({})} ---")
    
    print("\n✓✓✓ Environment setup COMPLETE! ✓✓✓")
    
except Exception as e:
    print(f"Error: {e}")
    
finally:
    # Close the connection
    client.close()
    print("\nConnection closed.")