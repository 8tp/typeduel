export interface Passage {
  text: string
  difficulty: 'easy' | 'medium' | 'hard'
}

const passages: Passage[] = [
  // ── Easy ──
  {
    difficulty: 'easy',
    text: 'The quick brown fox jumps over the lazy dog. She sells sea shells by the sea shore. A warm cup of tea sat on the table near the window.',
  },
  {
    difficulty: 'easy',
    text: 'The sun was low in the sky and the air was cool and still. Birds sang from the tall trees and the river ran slow and clear over smooth stones.',
  },
  {
    difficulty: 'easy',
    text: 'He ran to the store to get milk and bread. The dog sat by the door and waited. She read a book in the park under a big old tree.',
  },
  {
    difficulty: 'easy',
    text: 'Rain fell on the roof all night long. The cat slept by the fire and did not move. In the morning the sky was clear and the grass was wet.',
  },
  {
    difficulty: 'easy',
    text: 'The boat moved slow on the lake. Fish swam just below the top of the water. A bird flew down and took one in its claws then rose back up.',
  },
  {
    difficulty: 'easy',
    text: 'They walked down the path to the old barn. The door was red and the roof was made of tin. A horse stood in the shade and ate some hay.',
  },
  {
    difficulty: 'easy',
    text: 'She put on her coat and hat and went out. The wind was cold but the sun was bright. Snow had fallen in the night and made the world white.',
  },
  {
    difficulty: 'easy',
    text: 'The clock on the wall said it was late. He closed his book and turned off the lamp. The house was dark and still and he went up to bed.',
  },
  {
    difficulty: 'easy',
    text: 'A small girl sat on the steps and drew with chalk. Her dog lay next to her in the sun. The sky was blue and there were no clouds at all.',
  },
  {
    difficulty: 'easy',
    text: 'The man drove his truck down a long dirt road. Dust rose up in a cloud and then fell back down. He could see the farm from the top of the hill.',
  },

  // ── Medium ──
  {
    difficulty: 'medium',
    text: 'Programming is the art of telling another human what one wants the computer to do. Good code is its own best documentation, and when you find yourself adding comments, consider rewriting the code instead.',
  },
  {
    difficulty: 'medium',
    text: 'The greatest enemy of knowledge is not ignorance, it is the illusion of knowledge. Every expert was once a beginner, and every professional was once an amateur learning their craft.',
  },
  {
    difficulty: 'medium',
    text: 'Distributed systems are fundamentally about trade-offs between consistency, availability, and partition tolerance. Understanding these constraints helps engineers design resilient architectures.',
  },
  {
    difficulty: 'medium',
    text: 'Effective debugging requires patience and systematic thinking. Start by reproducing the bug reliably, then isolate the failing component. Binary search through your assumptions until you find the root cause.',
  },
  {
    difficulty: 'medium',
    text: 'The internet transformed how humans communicate, collaborate, and create. What began as a military research network evolved into the backbone of modern civilization, connecting billions of devices worldwide.',
  },
  {
    difficulty: 'medium',
    text: 'Version control is a system that records changes to files over time so that you can recall specific versions later. It allows multiple developers to collaborate without overwriting each other\'s work.',
  },
  {
    difficulty: 'medium',
    text: 'Typography matters more than most people realize. The spacing between letters, the weight of the strokes, and the shape of each character all contribute to readability and the feeling a text conveys.',
  },
  {
    difficulty: 'medium',
    text: 'Machine learning algorithms identify patterns in data without being explicitly programmed. They improve through experience, adjusting their parameters to minimize prediction errors across training examples.',
  },
  {
    difficulty: 'medium',
    text: 'The scientific method involves forming hypotheses, designing experiments, collecting data, and drawing conclusions. Peer review ensures that findings are scrutinized before being accepted by the community.',
  },
  {
    difficulty: 'medium',
    text: 'Open source software has reshaped the technology landscape. Projects maintained by global communities of volunteers power everything from web servers to operating systems to artificial intelligence frameworks.',
  },

  // ── Hard ──
  {
    difficulty: 'hard',
    text: 'The Byzantine Generals\' Problem illustrates the difficulty of achieving consensus in distributed systems where participants may be unreliable. Lamport\'s solution requires 3f+1 nodes to tolerate f Byzantine faults.',
  },
  {
    difficulty: 'hard',
    text: 'Quantum entanglement — described by Einstein as "spooky action at a distance" — enables correlations between particles that persist regardless of separation. This phenomenon underpins quantum cryptography & teleportation protocols.',
  },
  {
    difficulty: 'hard',
    text: 'The Curry-Howard correspondence establishes a deep isomorphism between computer programs and mathematical proofs: types correspond to propositions, and programs correspond to proofs. This duality bridges logic & computation.',
  },
  {
    difficulty: 'hard',
    text: 'Implementing lock-free data structures requires careful use of atomic compare-and-swap (CAS) operations. The ABA problem — where a value changes from A to B and back to A — can cause subtle, non-deterministic bugs.',
  },
  {
    difficulty: 'hard',
    text: 'CRISPR-Cas9 gene editing leverages bacterial immune mechanisms to make precise modifications to DNA sequences. Off-target effects remain a significant concern; specificity depends on guide RNA complementarity & PAM recognition.',
  },
  {
    difficulty: 'hard',
    text: 'Zero-knowledge proofs allow one party (the prover) to convince another (the verifier) that a statement is true without revealing *any* information beyond the statement\'s validity. zk-SNARKs achieve this non-interactively.',
  },
  {
    difficulty: 'hard',
    text: 'The Navier-Stokes equations describe fluid motion: $\\partial_t \\mathbf{u} + (\\mathbf{u} \\cdot \\nabla)\\mathbf{u} = -\\nabla p + \\nu \\nabla^2 \\mathbf{u}$. Proving existence & smoothness of solutions in 3D remains an open Millennium Prize problem.',
  },
  {
    difficulty: 'hard',
    text: 'Rust\'s ownership model prevents data races at compile time through three rules: each value has exactly one owner; ownership can be transferred (moved) or borrowed (&T / &mut T); mutable references are exclusive.',
  },
  {
    difficulty: 'hard',
    text: 'Paxos consensus proceeds in two phases: prepare/promise (phase 1a/1b) and accept/accepted (phase 2a/2b). A proposer must secure a majority quorum in each phase. Multi-Paxos optimizes by electing a stable leader.',
  },
  {
    difficulty: 'hard',
    text: 'Homomorphic encryption enables computation on ciphertexts such that decrypting the result yields the same output as performing the operations on plaintext. Fully homomorphic encryption (FHE) supports arbitrary circuits but incurs ~10,000x overhead.',
  },
]

export function getRandomPassage(difficulty?: 'easy' | 'medium' | 'hard'): Passage {
  const pool = difficulty
    ? passages.filter(p => p.difficulty === difficulty)
    : passages
  const idx = Math.floor(Math.random() * pool.length)
  return pool[idx]
}
