/**
 * Standalone Seed Reference for Rabbit Mediko — Sharma Family Demo Data
 *
 * Note: In the web app, click "Load Demo Family (Sharma Family)" on Family Setup
 * or Settings to populate this dataset directly for your authenticated user UID.
 *
 * Dataset summary:
 * - Family: "Sharma Family" (+91 98401 22334)
 * - Members:
 *   1. Ramesh Sharma (58, M, B+, Allergies: Penicillin, Conditions: Diabetes, BP)
 *   2. Lakshmi Sharma (54, F, O+, Allergies: None, Conditions: Thyroid)
 *   3. Priya Sharma (24, F, A+, Allergies: Peanut, Conditions: None)
 * - 7 BP readings & 5 Fasting Sugar readings for Ramesh
 * - 1 week (7 days) of Indian home-cooked meal plans
 * - 3 active medicines with schedules (1 expiring within 5 days)
 * - 7 categorized grocery list items
 * - 3 public emergencyCards/{cardId} documents
 */
export { seedDemoFamily } from '../src/services/seedData';
