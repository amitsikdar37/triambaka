import socket
from cryptography.fernet import Fernet

def load_key():
    """Load the shared secret key."""
    with open("secret.key", "rb") as key_file:
        return key_file.read()

def start_sender():
    # Load the key and initialize Fernet
    key = load_key()
    fernet = Fernet(key)

    host = '127.0.0.1'  # The server's hostname or IP address (localhost)
    port = 65432        # The port used by the server

    # Get the message from the user
    print("=== Secure Messaging Client ===")
    message = input("Enter your message to send (or press Enter for default 'i need help'): ")
    if not message.strip():
        message = "i need help"

    # Encrypt the message into ciphertext using Fernet
    # Strings must be encoded into bytes before encryption
    ciphertext = fernet.encrypt(message.encode())
    
    # Print the ciphertext to the console before sending
    print(f"\n[+] Message encrypted successfully.")
    print(f"[+] Raw ciphertext to be sent over the network:")
    print(ciphertext)

    # Connect to the receiver and send the encrypted bytes
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.connect((host, port))
            s.sendall(ciphertext)
            print("\n[+] Ciphertext sent successfully to Device B!")
        except ConnectionRefusedError:
            print("\n[!] Error: Connection refused. Make sure receiver.py is running first!")

if __name__ == "__main__":
    start_sender()
