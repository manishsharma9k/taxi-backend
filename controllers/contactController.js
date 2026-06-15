import Contact from '../models/Contact.js';

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message, userType } = req.body;
    
    if (!name || !email || !message || !userType) {
      return res.status(400).json({ message: 'Please provide name, email, userType and message' });
    }

    const newContact = await Contact.create({
      name,
      email,
      subject,
      message,
      userType,
    });

    res.status(201).json({
      message: 'Contact form submitted successfully',
      contact: newContact,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting contact form', error: error.message });
  }
};
