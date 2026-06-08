import socket
from cryptography.fernet import Fernet

def load_key():
    """Load the shared secret key."""
    with open("secret.key", "rb") as key_file:
        return key_file.read()

def start_receiver():
    # Load the key and initialize Fernet
    key = load_key()
    fernet = Fernet(key)

    host = '127.0.0.1'  # Standard loopback interface address (localhost)
    port = 65432        # Port to listen on (non-privileged ports are > 1023)

    # Set up the socket server
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, port))
        s.listen()
        print(f"Receiver listening on {host}:{port}...")
        
        # Accept incoming connection
        conn, addr = s.accept()
        with conn:
            print(f"Connection accepted from {addr}")
            
            # Wait to receive data
            data = conn.recv(1024)
            if data:
                # Print the raw encrypted ciphertext
                print(f"\n[+] Received raw encrypted bytes (Ciphertext):")
                print(data)
                
                # Decrypt the data back into plaintext
                plaintext = fernet.decrypt(data)
                print(f"\n[+] Decrypted plaintext message:")
                print(plaintext.decode())

if __name__ == "__main__":
    start_receiver()
