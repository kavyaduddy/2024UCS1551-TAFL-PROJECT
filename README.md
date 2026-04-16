# Finite Automata Simulator (DFA/NFA)

This project is an interactive web application developed to design and simulate Deterministic Finite Automata (DFA) and Non-Deterministic Finite Automata (NFA).

## Features

* Creation of states (Q)
* Definition of input alphabet (Σ)
* Specification of transition function (δ)
* Selection of start state and accept states (F)
* Graphical visualization of the automaton
* Step-by-step simulation of input strings
* Transition log for each step
* Input validation for incorrect or undefined states

## Working Principle

The simulator processes the input string symbol by symbol starting from the initial state.

* In a DFA, a single current state is updated based on the transition function.
* In an NFA, a set of possible states is maintained at each step.

At the end of the input, the string is accepted if the final state (or any state in the set for NFA) belongs to the set of accept states.

## How to Run

1. Download or clone the repository
2. Open the `index.html` file in a web browser

## Example

Input: 01000011

The simulator displays step-by-step transitions and determines whether the string is accepted or rejected.

## Tech Stack

* HTML
* CSS
* JavaScript

## Author

Kavya Duddy ( 2024UCS1551 )
