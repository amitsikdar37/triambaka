const API_KEY = 'b71d48bdd175da8be79f4d2be173a346';

export const validatePhoneNumber = async (phoneNumber) => {
  try {
    // Basic sanitization
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    const url = `http://apilayer.net/api/validate?access_key=${API_KEY}&number=${cleanNumber}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.info || 'API Error');
    }
    
    return data;
  } catch (error) {
    console.error("Error fetching carrier info:", error);
    throw error;
  }
};
