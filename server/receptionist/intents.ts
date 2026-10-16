/**
 * Training data for the receptionist's intent classifier. Each intent is a
 * set of example messages (more variety = better recall) plus keywords that
 * on their own signal the intent. Add examples here to teach it new phrasings.
 */
import type { IntentDefinition } from '../../packages/localbrain/src/index.ts';

export const INTENTS: IntentDefinition[] = [
  {
    name: 'greet',
    examples: [
      'hi', 'hello', 'hey', 'hi there', 'hello there', 'hey there', 'good morning', 'good afternoon', 'good evening',
      'hiya', 'howdy', 'greetings', 'is anyone there', 'anybody there', 'hi I have a question', 'hello I need some help',
      'hey how are you',
    ],
  },
  {
    name: 'thanks',
    examples: [
      'thanks', 'thank you', 'thank you so much', 'thanks a lot', 'many thanks', 'cheers', 'appreciate it',
      'I appreciate your help', 'that is helpful thanks', 'great thanks', 'perfect thank you', 'thx', 'ty', 'awesome thanks',
    ],
    keywords: ['thank you', 'thanks'],
  },
  {
    name: 'bye',
    examples: [
      'bye', 'goodbye', 'see you', 'talk later', 'that is all', 'that is all for now', 'have a nice day', 'have a good day',
      'I am done', 'nothing else', 'no more questions', 'that is everything', 'catch you later',
    ],
  },
  {
    name: 'affirm',
    examples: [
      'yes', 'yeah', 'yep', 'yes please', 'sure', 'ok', 'okay', 'sounds good', 'that works', 'that works for me', 'perfect',
      'great', 'definitely', 'absolutely', 'of course', 'please do', 'go ahead', 'lets do it', 'correct', 'that is right',
      'yes that is fine', 'alright', 'sure thing', 'yes I would like that', 'ok book it', 'yes book me in',
    ],
  },
  {
    name: 'deny',
    examples: [
      'no', 'nope', 'no thanks', 'no thank you', 'not now', 'not really', 'not interested', 'maybe later', 'I will pass',
      'none of those', 'neither', 'those do not work', 'that does not work', 'none of them work', 'not yet', 'nah',
      'no I am good', 'not at the moment',
    ],
  },
  {
    name: 'book',
    examples: [
      'I want to book an appointment', 'can I make an appointment', 'I would like to schedule a visit', 'book me in',
      'can I come in this week', 'do you have any openings', 'what times are available', 'when is your next available appointment',
      'I need to see the dentist', 'I would like a consultation', 'can I get a consultation', 'schedule a visit for next week',
      'I want to come in for a visit', 'set up an appointment', 'are there any slots tomorrow', 'can you fit me in',
      'how soon can I be seen', 'I would like to book a free consultation', 'can I book online', 'I would like to come in on friday',
      'do you have availability next week', 'I want to book a session', 'can I schedule an exam', 'get me in as soon as you can',
      'when can I come in', 'I am ready to book',
    ],
    keywords: ['appointment', 'book', 'booking', 'schedule', 'availability', 'available times', 'openings', 'fit me in', 'come in'],
  },
  {
    name: 'reschedule',
    examples: [
      'I need to reschedule', 'can I cancel my appointment', 'I want to change my appointment time', 'I cannot make my appointment',
      'move my booking to next week', 'cancel my booking', 'I need to move my appointment', 'something came up and I need a different time',
    ],
    keywords: ['reschedule', 'cancel my', 'change my appointment', 'move my appointment', 'move my booking'],
  },
  {
    name: 'price',
    examples: [
      'how much does it cost', 'how much are they', 'what is the price', 'what do you charge for that',
      'is it expensive', 'how much would it be', 'can I get a quote', 'what are your fees', 'what is the cost of a visit',
      'what is the price range', 'how much for a consultation', 'is the consultation free', 'ballpark cost', 'rough estimate',
      'how much is the treatment', 'what does it cost without insurance', 'how much do they cost',
    ],
    keywords: ['how much', 'cost', 'costs', 'price', 'prices', 'pricing', 'fee', 'fees', 'expensive', 'quote', 'afford', 'charge'],
  },
  {
    name: 'financing',
    examples: [
      'do you offer financing', 'can I pay monthly', 'do you have payment plans', 'can I spread the cost', 'do you take carecredit',
      'what payment methods do you accept', 'do you take credit cards', 'can I pay in installments',
      'do you accept hsa', 'can I use my fsa card', 'is there a payment plan for treatment',
    ],
    keywords: ['financing', 'finance', 'payment plan', 'payment plans', 'monthly payments', 'installments', 'carecredit', 'pay monthly', 'payment options', 'payment methods'],
  },
  {
    name: 'insurance',
    examples: [
      'do you take my insurance', 'do you accept delta dental', 'are you in network with cigna', 'will insurance cover this',
      'does insurance cover it', 'what insurance do you accept', 'I have aetna', 'do you take medicaid', 'I do not have insurance',
      'are you in network', 'do you bill insurance',
    ],
    keywords: ['insurance', 'insured', 'ppo', 'hmo', 'medicaid', 'medicare', 'delta dental', 'cigna', 'aetna', 'metlife', 'guardian', 'in network', 'out of network', 'coverage'],
  },
  {
    name: 'hours',
    examples: [
      'what are your hours', 'when are you open', 'are you open on saturday', 'what time do you close', 'are you open today',
      'what time do you open tomorrow', 'are you open on weekends', 'opening hours', 'are you closed on sunday', 'are you open late',
      'what days are you open', 'office hours',
    ],
    keywords: ['hours', 'open', 'opening', 'close', 'closing', 'closed'],
  },
  {
    name: 'location',
    examples: [
      'where are you located', 'what is your address', 'how do I get there', 'is there parking', 'where is the clinic',
      'directions please', 'which part of town are you in', 'are you near downtown', 'where do I park', 'what is the location',
    ],
    keywords: ['address', 'located', 'location', 'directions', 'parking', 'where are you', 'where is the'],
  },
  {
    name: 'human',
    examples: [
      'can I talk to a real person', 'I want to speak to someone', 'can someone call me', 'please call me back',
      'connect me to the front desk', 'I would rather talk to a human', 'can I speak with the dentist', 'have someone contact me',
      'I want a call back', 'can a person help me',
    ],
    keywords: ['human', 'real person', 'receptionist', 'speak to someone', 'talk to someone', 'call me', 'call back', 'callback', 'representative', 'front desk', 'staff member'],
  },
  {
    name: 'about_bot',
    examples: [
      'are you a robot', 'are you a bot', 'are you human', 'who am I talking to', 'what are you', 'what can you do',
      'are you ai', 'how can you help me', 'what can I ask you', 'is this automated',
    ],
  },
  {
    name: 'new_patient',
    examples: [
      'are you accepting new patients', 'I am a new patient', 'do you take new patients', 'what happens at my first visit',
      'what should I bring to my first appointment', 'I have never been to your office', 'first time visiting', 'how do I register',
    ],
    keywords: ['new patient', 'new patients', 'first visit', 'first appointment'],
  },
  {
    name: 'services',
    examples: [
      'what services do you offer', 'what treatments do you do', 'what do you offer', 'do you do cosmetic dentistry',
      'what kind of dentistry do you do', 'list of services', 'what can you help with', 'what procedures do you offer',
    ],
    keywords: ['services', 'treatments do you', 'procedures do you', 'what do you offer'],
  },
  {
    name: 'opt_out',
    examples: [
      'unsubscribe', 'please stop contacting me', 'remove me from your list', 'I do not want any more messages',
      'stop sending me emails', 'do not contact me again', 'take me off your mailing list', 'stop emailing me',
    ],
    keywords: ['unsubscribe', 'opt out', 'stop contacting', 'stop emailing', 'stop texting', 'stop sending', 'do not contact', 'remove me', 'take me off'],
  },
  {
    name: 'emergency',
    examples: [
      'I have a dental emergency', 'my tooth got knocked out', 'I broke my tooth', 'my face is swollen', 'I am in severe pain',
      'my gums will not stop bleeding', 'I think I have an abscess', 'I chipped my front tooth',
      'unbearable toothache', 'my tooth is killing me', 'I need to be seen today it is urgent',
      'my jaw is swollen', 'my tooth hurts so much', 'toothache', 'it is an emergency', 'I need help right away',
    ],
    keywords: ['emergency', 'urgent', 'toothache', 'knocked out', 'abscess'],
  },
  {
    name: 'diagnosis',
    examples: [
      'what is wrong with my tooth', 'is my tooth infected', 'why does my tooth hurt when I bite', 'is this normal',
      'can you tell me what this is', 'should I be worried about this bump on my gum', 'can you diagnose me',
      'could this be serious', 'what do you think is causing it', 'is this something serious',
    ],
    keywords: ['diagnose', 'diagnosis', 'wrong with my'],
  },
  {
    name: 'procedure_info',
    examples: [
      'tell me about implants', 'what are veneers', 'how does invisalign work', 'do you do teeth whitening', 'how long do implants take',
      'does a root canal hurt', 'how long do veneers last', 'what is bonding', 'what are my options for missing teeth',
      'recovery time for wisdom teeth', 'can you fix crooked teeth', 'what is the difference between veneers and bonding',
      'do you offer clear aligners', 'how often should I get a cleaning', 'is whitening safe', 'I am interested in veneers',
      'I want whiter teeth', 'I want to straighten my teeth', 'I am missing a tooth', 'I have a gap in my teeth', 'what is a crown',
      'what is involved in getting implants', 'information about dentures',
    ],
  },
];

/** Intents that carry little meaning when combined with a real question ("hi, how much are implants?"). */
export const SOCIAL_INTENTS = new Set(['greet', 'thanks', 'bye', 'affirm', 'deny']);
