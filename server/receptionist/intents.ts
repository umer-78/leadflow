/**
 * Training data for the receptionist's intent classifier. Each intent is a
 * set of example messages (more variety = better recall) plus keywords that
 * on their own signal the intent. Add examples here to teach it new phrasings;
 * `npm run eval` shows the effect on the quality bench.
 *
 * Keep treatment names out of the examples: what a message is about comes
 * from the knowledge base, the intent is only what the visitor wants to do.
 */
import type { IntentDefinition } from '../../packages/localbrain/src/index.ts';

export const INTENTS: IntentDefinition[] = [
  {
    name: 'greet',
    examples: [
      'hi', 'hello', 'hey', 'hi there', 'hello there', 'hey there', 'good morning', 'good afternoon', 'good evening',
      'hiya', 'howdy', 'greetings', 'is anyone there', 'anybody there', 'hi I have a question', 'hello I need some help',
      'yo', 'heya', 'hey hey', 'morning', 'afternoon', 'hello anyone', 'hi team', 'hello good morning', 'hey I need help',
      'is somebody there', 'hello is this the dentist', 'hi can you help me', 'hey can I ask something',
    ],
  },
  {
    name: 'smalltalk',
    examples: [
      'how are you', 'how are you doing', 'how are you today', 'how is it going', 'hows it going', 'whats up', 'what is up',
      'how is your day', 'how is your day going', 'how have you been', 'are you having a good day', 'how do you do',
      'nice to meet you', 'pleased to meet you', 'what is your name', 'do you have a name', 'who made you',
    ],
  },
  {
    name: 'thanks',
    examples: [
      'thanks', 'thank you', 'thank you so much', 'thanks a lot', 'many thanks', 'cheers', 'appreciate it',
      'I appreciate your help', 'that is helpful thanks', 'great thanks', 'perfect thank you', 'thx', 'ty', 'awesome thanks',
      'thanks for your help', 'thank you very much', 'much appreciated', 'thanks for the info', 'that helps thanks',
      'ok thank you', 'brilliant thanks', 'lovely thank you', 'thanks so much for helping',
    ],
    keywords: ['thank you', 'thanks', 'appreciate it'],
  },
  {
    name: 'compliment',
    examples: [
      'you are great', 'you are very helpful', 'that was helpful', 'very helpful', 'you are awesome', 'good bot',
      'you are smart', 'great answer', 'that is exactly what I needed', 'you have been so helpful', 'nice work',
    ],
  },
  {
    name: 'complaint',
    examples: [
      'you are useless', 'this is not helpful', 'that is not helpful', 'you do not understand', 'you dont understand me',
      'that is not what I asked', 'wrong answer', 'that is wrong', 'stupid bot', 'this bot is useless', 'you are not listening',
      'that makes no sense', 'this is frustrating', 'I already told you', 'you keep saying the same thing', 'answer my question',
      'not what I meant', 'terrible service', 'I am not happy', 'I want to make a complaint', 'I have a complaint',
    ],
    keywords: ['useless', 'not helpful', 'complaint', 'makes no sense', 'not what i asked'],
  },
  {
    name: 'joke',
    examples: [
      'tell me a joke', 'make me laugh', 'say something funny', 'do you know any jokes', 'got any jokes', 'tell me something funny',
      'can you tell me a joke', 'I need a laugh', 'know any dentist jokes',
    ],
    keywords: ['joke', 'jokes', 'make me laugh'],
  },
  {
    name: 'offtopic',
    examples: [
      'what is the weather like', 'what is the weather today', 'will it rain tomorrow', 'who won the game last night',
      'what is the news', 'can you help me with my homework', 'write me a poem', 'what is the capital of france',
      'recommend a good restaurant', 'what time is it in london', 'who is the president', 'tell me about bitcoin',
      'what is the meaning of life', 'can you order me a pizza', 'play some music', 'what movies are showing',
      'how do I cook pasta', 'translate this to spanish', 'what is two plus two', 'are you single',
    ],
    keywords: ['weather', 'poem', 'homework', 'pizza', 'bitcoin', 'football', 'soccer score', 'movie'],
  },
  {
    name: 'bye',
    examples: [
      'bye', 'goodbye', 'see you', 'talk later', 'that is all', 'that is all for now', 'have a nice day', 'have a good day',
      'I am done', 'nothing else', 'no more questions', 'that is everything', 'catch you later', 'bye bye', 'see ya',
      'ok bye', 'thanks bye', 'gotta go', 'I have to go', 'talk to you later', 'good night', 'that will be all',
    ],
  },
  {
    name: 'affirm',
    examples: [
      'yes', 'yeah', 'yep', 'yes please', 'sure', 'ok', 'okay', 'sounds good', 'that works', 'that works for me', 'perfect',
      'great', 'definitely', 'absolutely', 'of course', 'please do', 'go ahead', 'lets do it', 'correct', 'that is right',
      'yes that is fine', 'alright', 'sure thing', 'yes I would like that', 'ok book it', 'yes book me in', 'yup', 'ya',
      'cool', 'sounds great', 'yes please do', 'why not', 'I would love that', 'sure go ahead', 'ok lets do that', 'fine',
      'yes that would be great', 'please', 'yes I do', 'I would like that', 'that would be good', 'deal', 'do it',
    ],
  },
  {
    name: 'deny',
    examples: [
      'no', 'nope', 'no thanks', 'no thank you', 'not now', 'not really', 'not interested', 'maybe later', 'I will pass',
      'none of those', 'neither', 'those do not work', 'that does not work', 'none of them work', 'not yet', 'nah',
      'no I am good', 'not at the moment', 'I am ok thanks', 'not today', 'I do not want to', 'no I just had a question',
      'no need', 'that is ok', 'I will think about it', 'not right now', 'no that is all',
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
      'when can I come in', 'I am ready to book', 'do you have anything tomorrow', 'anything available on monday',
      'do you have time on friday afternoon', 'is there anything open next week', 'can I get in today',
      'what is your earliest appointment', 'I need an appointment', 'I want an appointment', 'make me an appointment',
      'can I book for next week', 'I would like to see someone', 'book a visit', 'schedule me', 'I need to come in',
      'can you see me this week', 'can you see me today', 'could you see me tomorrow', 'can you fit me in this week', 'can she come in tomorrow',
      'can he come in today', 'can my son come in this week', 'can you squeeze me in', 'is there a time this week',
      'do you have a slot on tuesday', 'any appointments left this week', 'can I see the dentist tomorrow',
      'I would like to make a booking', 'reserve a time for me', 'let me book', 'sign me up for an appointment',
    ],
    keywords: ['appointment', 'appointments', 'book', 'booking', 'schedule', 'availability', 'available times', 'any openings', 'fit me in', 'come in', 'see me', 'squeeze me in'],
  },
  {
    name: 'reschedule',
    examples: [
      'I need to reschedule', 'can I cancel my appointment', 'I want to change my appointment time', 'I cannot make my appointment',
      'move my booking to next week', 'cancel my booking', 'I need to move my appointment', 'something came up and I need a different time',
      'I have to cancel', 'can I change the time of my visit', 'I will be late for my appointment', 'I am running late',
      'push my appointment back', 'I need to cancel tomorrow', 'can we reschedule', 'I can no longer come in',
    ],
    keywords: ['reschedule', 'cancel my', 'change my appointment', 'move my appointment', 'move my booking', 'running late'],
  },
  {
    name: 'price',
    examples: [
      'how much does it cost', 'how much are they', 'what is the price', 'what do you charge for that',
      'is it expensive', 'how much would it be', 'can I get a quote', 'what are your fees', 'what is the cost of a visit',
      'what is the price range', 'how much for a consultation', 'ballpark cost', 'rough estimate',
      'how much is the treatment', 'what does it cost without insurance', 'how much do they cost', 'price please',
      'what are your prices', 'how much do you charge', 'can you give me a price', 'how expensive is it', 'cost?',
      'what would I pay', 'is it affordable', 'what is the starting price', 'how much roughly', 'how much is it per tooth',
      'do you have a price list', 'what are the costs involved', 'how much will it set me back',
    ],
    keywords: ['how much', 'cost', 'costs', 'price', 'prices', 'pricing', 'fee', 'fees', 'expensive', 'quote', 'afford', 'charge'],
  },
  {
    name: 'financing',
    examples: [
      'do you offer financing', 'can I pay monthly', 'do you have payment plans', 'can I spread the cost', 'do you take carecredit',
      'what payment methods do you accept', 'do you take credit cards', 'can I pay in installments',
      'do you accept hsa', 'can I use my fsa card', 'is there a payment plan for treatment', 'do you take cash',
      'can I pay over time', 'do you do finance', 'is there 0 percent financing', 'can I pay in parts',
      'what are my payment options', 'do you accept apple pay', 'can I pay later',
    ],
    keywords: ['financing', 'finance', 'payment plan', 'payment plans', 'monthly payments', 'installments', 'carecredit', 'care credit', 'pay monthly', 'payment options', 'payment methods', 'pay over time'],
  },
  {
    name: 'insurance',
    examples: [
      'do you take my insurance', 'do you accept delta dental', 'are you in network with cigna', 'will insurance cover this',
      'does insurance cover it', 'what insurance do you accept', 'I have aetna', 'do you take medicaid', 'I do not have insurance',
      'are you in network', 'do you bill insurance', 'which insurance plans do you take', 'do you take metlife',
      'is this covered by insurance', 'I have a ppo plan', 'do you accept my dental plan', 'I am uninsured',
      'do you file claims', 'can you check my benefits', 'are you out of network',
    ],
    keywords: ['insurance', 'insured', 'uninsured', 'ppo', 'hmo', 'medicaid', 'medicare', 'delta dental', 'cigna', 'aetna', 'metlife', 'guardian', 'in network', 'out of network', 'coverage'],
  },
  {
    name: 'hours',
    examples: [
      'what are your hours', 'when are you open', 'are you open on saturday', 'what time do you close', 'are you open today',
      'what time do you open tomorrow', 'are you open on weekends', 'opening hours', 'are you closed on sunday', 'are you open late',
      'what days are you open', 'office hours', 'what time do you open', 'are you open now', 'until what time are you open',
      'are you open in the evening', 'what are your weekend hours', 'business hours', 'when do you close today',
      'are you open on public holidays', 'how late are you open',
    ],
    keywords: ['hours', 'opening hours', 'office hours', 'open today', 'closing time'],
  },
  {
    name: 'location',
    examples: [
      'where are you located', 'what is your address', 'how do I get there', 'is there parking', 'where is the clinic',
      'directions please', 'which part of town are you in', 'are you near downtown', 'where do I park', 'what is the location',
      'where is your office', 'how do I find you', 'send me the address', 'is it easy to park', 'can I take the bus there',
      'is your office accessible', 'is there wheelchair access', 'what floor are you on',
    ],
    keywords: ['address', 'located', 'location', 'directions', 'parking', 'where are you', 'where is the', 'wheelchair'],
  },
  {
    name: 'human',
    examples: [
      'can I talk to a real person', 'I want to speak to someone', 'can someone call me', 'please call me back',
      'connect me to the front desk', 'I would rather talk to a human', 'can I speak with the dentist', 'have someone contact me',
      'I want a call back', 'can a person help me', 'let me talk to a human', 'is there a person I can talk to',
      'I need to speak with the office', 'transfer me to staff', 'get me a real person', 'can the doctor call me',
      'I want to talk to the manager', 'speak to reception',
    ],
    keywords: ['human', 'real person', 'receptionist', 'speak to someone', 'talk to someone', 'call me', 'call back', 'callback', 'representative', 'front desk', 'staff member'],
  },
  {
    name: 'contact_info',
    examples: [
      'what is your phone number', 'whats your number', 'how can I contact you', 'what is your email', 'can I call you',
      'phone number please', 'what is your website', 'how do I reach the office', 'give me your number', 'email address please',
      'how do I get in touch', 'what number do I call',
    ],
    keywords: ['phone number', 'your number', 'email address', 'your email', 'contact you', 'get in touch', 'your website'],
  },
  {
    name: 'team',
    examples: [
      'who are the dentists', 'who is the dentist', 'tell me about your doctors', 'how experienced are your dentists',
      'who will I see', 'is the dentist a woman', 'who works there', 'what are the qualifications of the dentist',
      'can I choose my dentist', 'do you have a female dentist', 'who owns the practice',
    ],
    keywords: ['your dentists', 'the dentists', 'your doctors', 'qualifications', 'experienced'],
  },
  {
    name: 'walk_in',
    examples: [
      'do you accept walk ins', 'can I just walk in', 'do I need an appointment', 'do you take walk-ins',
      'can I come in without an appointment', 'do you do same day appointments', 'can I just show up',
    ],
    keywords: ['walk in', 'walk ins', 'walk-in', 'walkin', 'without an appointment', 'same day appointment', 'just show up'],
  },
  {
    name: 'about_bot',
    examples: [
      'are you a robot', 'are you a bot', 'are you human', 'who am I talking to', 'what are you', 'what can you do',
      'are you ai', 'how can you help me', 'what can I ask you', 'is this automated', 'am I talking to a computer',
      'are you a real person', 'is this a chatbot', 'are you chatgpt',
    ],
  },
  {
    name: 'new_patient',
    examples: [
      'are you accepting new patients', 'I am a new patient', 'do you take new patients', 'what happens at my first visit',
      'what should I bring to my first appointment', 'I have never been to your office', 'first time visiting', 'how do I register',
      'I just moved to the area and need a dentist', 'I am looking for a new dentist', 'do I need to fill out forms',
      'how do I become a patient', 'can I switch to your practice',
    ],
    keywords: ['new patient', 'new patients', 'first visit', 'first appointment', 'new dentist'],
  },
  {
    name: 'services',
    examples: [
      'what services do you offer', 'what treatments do you do', 'what do you offer', 'do you do cosmetic dentistry',
      'what kind of dentistry do you do', 'list of services', 'what can you help with', 'what procedures do you offer',
      'what treatments are available', 'what do you specialize in', 'what kind of work do you do', 'show me your services',
    ],
    keywords: ['services', 'treatments do you', 'procedures do you', 'what do you offer'],
  },
  {
    name: 'opt_out',
    examples: [
      'unsubscribe', 'please stop contacting me', 'remove me from your list', 'I do not want any more messages',
      'stop sending me emails', 'do not contact me again', 'take me off your mailing list', 'stop emailing me',
      'stop messaging me', 'leave me alone', 'no more emails please', 'opt me out',
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
      'emergency appointment please', 'I need an emergency dentist', 'urgent dental problem',
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
      'tell me about it', 'what is it', 'how does it work', 'how long does it take', 'does it hurt', 'how long does it last',
      'what is the recovery like', 'is it safe', 'what are my options', 'can you fix crooked teeth', 'what is the difference',
      'how often should I get it done', 'I am interested in that treatment', 'I want whiter teeth', 'I want to straighten my teeth',
      'I am missing a tooth', 'I have a gap in my teeth', 'what is involved', 'information about treatment',
      'do you do that', 'is it painful', 'what are the side effects', 'am I a good candidate', 'what should I avoid afterwards',
      'can I eat normally', 'what are the alternatives', 'will it look natural', 'how many visits will I need',
    ],
  },
];

/** Intents that carry little meaning when combined with a real question ("hi, how much are implants?"). */
export const SOCIAL_INTENTS = new Set(['greet', 'thanks', 'bye', 'affirm', 'deny', 'smalltalk', 'compliment']);
