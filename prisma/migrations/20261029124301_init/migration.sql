-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('LOSE_FAT', 'GAIN_MUSCLE', 'RECOMPOSITION', 'HABITS');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "CookingStyle" AS ENUM ('QUICK', 'BALANCED', 'ELABORATE');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "TrainingLocation" AS ENUM ('GYM', 'HOME', 'OUTDOOR');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER', 'SUPPER');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('DARK', 'LIGHT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('PRIVACY_POLICY', 'HEALTH_DATA', 'AI_PROCESSING');

-- CreateEnum
CREATE TYPE "PreferenceKind" AS ENUM ('FAVORITE', 'DISLIKE', 'AVOID', 'ALLERGY', 'INTOLERANCE', 'RESTRICTION');

-- CreateEnum
CREATE TYPE "GoalSource" AS ENUM ('PROFESSIONAL', 'SELF');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('DAY', 'WEEK');

-- CreateEnum
CREATE TYPE "FoodState" AS ENUM ('RAW', 'COOKED', 'READY');

-- CreateEnum
CREATE TYPE "MeasureUnit" AS ENUM ('G', 'ML', 'UNIT');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('USER', 'PAID', 'IMPORT', 'DEMO', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "ShoppingListStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'LEGS', 'GLUTES', 'ABS', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssistantRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AssistantMode" AS ENUM ('TOOLS', 'AI');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_rate_limit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_rate_limit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "age" INTEGER,
    "heightCm" INTEGER,
    "goal" "Goal",
    "experienceLevel" "ExperienceLevel",
    "wakeTime" TEXT,
    "sleepTime" TEXT,
    "routineNotes" TEXT,
    "trainingDaysPerWeek" INTEGER,
    "trainingWeekdays" INTEGER[],
    "trainingTime" TEXT,
    "trainingMinutes" INTEGER,
    "trainingLocation" "TrainingLocation",
    "trainingEquipment" TEXT[],
    "mealSlots" "MealType"[],
    "mealTimes" TEXT[],
    "cookingStyle" "CookingStyle",
    "cookingMinutes" INTEGER,
    "kitchenEquipment" TEXT[],
    "budgetCents" INTEGER,
    "budgetPeriod" "BudgetPeriod",
    "hasNutritionist" BOOLEAN,
    "flexibleMealEnabled" BOOLEAN NOT NULL DEFAULT false,
    "flexibleMealWeekday" INTEGER,
    "flexibleMealType" "MealType",
    "trackWater" BOOLEAN NOT NULL DEFAULT false,
    "waterGoalMl" INTEGER,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompletedAt" TIMESTAMP(3),
    "xpTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'DARK',
    "animations" BOOLEAN NOT NULL DEFAULT true,
    "celebrations" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "notifyMeals" BOOLEAN NOT NULL DEFAULT false,
    "notifyWorkouts" BOOLEAN NOT NULL DEFAULT false,
    "notifyWater" BOOLEAN NOT NULL DEFAULT false,
    "notifyChallenges" BOOLEAN NOT NULL DEFAULT false,
    "assistantAiOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "consent_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ConsentKind" NOT NULL,
    "version" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PreferenceKind" NOT NULL,
    "tag" TEXT,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "GoalSource" NOT NULL,
    "period" "GoalPeriod" NOT NULL DEFAULT 'DAY',
    "kcal" INTEGER,
    "proteinG" INTEGER,
    "carbsG" INTEGER,
    "fatG" INTEGER,
    "mealsPerDay" INTEGER,
    "professionalName" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_source" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "edition" TEXT,
    "year" INTEGER,
    "url" TEXT,
    "license" TEXT NOT NULL,
    "notes" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceRef" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "state" "FoodState" NOT NULL,
    "basis" "MeasureUnit" NOT NULL DEFAULT 'G',
    "kcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "sodiumMg" DOUBLE PRECISION,
    "moisturePct" DOUBLE PRECISION,
    "missingFields" TEXT[],
    "notApplicable" TEXT[],
    "tags" TEXT[],
    "family" TEXT,
    "allergenReviewed" BOOLEAN NOT NULL DEFAULT false,
    "substitutionGroup" TEXT,
    "purchaseFoodId" TEXT,
    "purchaseFactor" DOUBLE PRECISION,
    "purchaseFactorMethod" TEXT,
    "householdMeasure" TEXT,
    "unitWeightG" DOUBLE PRECISION,
    "dataUpdatedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mealTypes" "MealType"[],
    "prepMinutes" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
    "equipment" TEXT[],
    "steps" TEXT[],
    "tags" TEXT[],
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "householdMeasure" TEXT,
    "scalable" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_meal" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "time" TEXT,
    "title" TEXT NOT NULL,
    "recipeId" TEXT,
    "isFlexible" BOOLEAN NOT NULL DEFAULT false,
    "customized" BOOLEAN NOT NULL DEFAULT false,
    "portionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_meal_item" (
    "id" TEXT NOT NULL,
    "plannedMealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "householdMeasure" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "planned_meal_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType",
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_log_item" (
    "id" TEXT NOT NULL,
    "mealLogId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "meal_log_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pantry_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantityG" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pantry_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "foodId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "packageSize" DOUBLE PRECISION NOT NULL,
    "packageUnit" "MeasureUnit" NOT NULL,
    "soldByWeight" BOOLEAN NOT NULL DEFAULT false,
    "densityGPerMl" DOUBLE PRECISION,
    "unitWeightG" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "storeName" TEXT,
    "observedAt" DATE NOT NULL,
    "source" "PriceSource" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "title" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ShoppingListStatus" NOT NULL DEFAULT 'OPEN',
    "budgetCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "shopping_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_item" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "productId" TEXT,
    "foodId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "requiredG" DOUBLE PRECISION NOT NULL,
    "pantryG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packageSize" DOUBLE PRECISION,
    "packageUnit" "MeasureUnit",
    "packageGrams" DOUBLE PRECISION,
    "soldByWeight" BOOLEAN NOT NULL DEFAULT false,
    "manualPackages" INTEGER,
    "unitPriceCents" INTEGER,
    "priceSource" "PriceSource",
    "priceStore" TEXT,
    "priceDate" DATE,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3),
    "paidCents" INTEGER,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryGroup" "MuscleGroup" NOT NULL,
    "secondaryMuscles" TEXT[],
    "equipment" TEXT[],
    "difficulty" "Difficulty" NOT NULL,
    "steps" TEXT[],
    "tips" TEXT[],
    "mistakes" TEXT[],
    "setsSuggested" INTEGER NOT NULL,
    "repsSuggested" TEXT NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "alternatives" TEXT[],
    "safety" TEXT[],
    "demoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_routine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_template" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workout_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_template_exercise" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "sets" INTEGER NOT NULL,
    "repsMin" INTEGER NOT NULL,
    "repsMax" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "workout_template_exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "perceivedEffort" INTEGER,
    "discomfort" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_exercise" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "restSeconds" INTEGER NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "session_exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_log" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "targetRepsMin" INTEGER NOT NULL,
    "targetRepsMax" INTEGER NOT NULL,
    "reps" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "set_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_measurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'sparkles',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_check" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "user_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "icon" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_challenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "user_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_message" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssistantRole" NOT NULL,
    "mode" "AssistantMode" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "profile_userId_key" ON "profile"("userId");

-- CreateIndex
CREATE INDEX "consent_record_userId_kind_idx" ON "consent_record"("userId", "kind");

-- CreateIndex
CREATE INDEX "food_preference_userId_idx" ON "food_preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "food_preference_userId_kind_label_key" ON "food_preference"("userId", "kind", "label");

-- CreateIndex
CREATE INDEX "nutrition_goal_userId_active_idx" ON "nutrition_goal"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "nutrition_source_code_key" ON "nutrition_source"("code");

-- CreateIndex
CREATE INDEX "food_name_idx" ON "food"("name");

-- CreateIndex
CREATE INDEX "food_ownerId_idx" ON "food"("ownerId");

-- CreateIndex
CREATE INDEX "food_substitutionGroup_idx" ON "food"("substitutionGroup");

-- CreateIndex
CREATE UNIQUE INDEX "food_sourceId_sourceRef_key" ON "food"("sourceId", "sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_slug_key" ON "recipe"("slug");

-- CreateIndex
CREATE INDEX "recipe_ownerId_idx" ON "recipe"("ownerId");

-- CreateIndex
CREATE INDEX "recipe_ingredient_recipeId_idx" ON "recipe_ingredient"("recipeId");

-- CreateIndex
CREATE INDEX "meal_plan_userId_weekStart_status_idx" ON "meal_plan"("userId", "weekStart", "status");

-- CreateIndex
CREATE INDEX "planned_meal_planId_date_idx" ON "planned_meal"("planId", "date");

-- CreateIndex
CREATE INDEX "planned_meal_item_plannedMealId_idx" ON "planned_meal_item"("plannedMealId");

-- CreateIndex
CREATE INDEX "meal_log_userId_date_idx" ON "meal_log"("userId", "date");

-- CreateIndex
CREATE INDEX "meal_log_item_mealLogId_idx" ON "meal_log_item"("mealLogId");

-- CreateIndex
CREATE UNIQUE INDEX "pantry_item_userId_foodId_key" ON "pantry_item"("userId", "foodId");

-- CreateIndex
CREATE INDEX "product_foodId_idx" ON "product"("foodId");

-- CreateIndex
CREATE INDEX "product_ownerId_idx" ON "product"("ownerId");

-- CreateIndex
CREATE INDEX "price_record_userId_productId_observedAt_idx" ON "price_record"("userId", "productId", "observedAt");

-- CreateIndex
CREATE INDEX "shopping_list_userId_status_idx" ON "shopping_list"("userId", "status");

-- CreateIndex
CREATE INDEX "shopping_list_item_listId_idx" ON "shopping_list_item"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_slug_key" ON "exercise"("slug");

-- CreateIndex
CREATE INDEX "exercise_primaryGroup_idx" ON "exercise"("primaryGroup");

-- CreateIndex
CREATE INDEX "workout_routine_userId_active_idx" ON "workout_routine"("userId", "active");

-- CreateIndex
CREATE INDEX "workout_template_routineId_idx" ON "workout_template"("routineId");

-- CreateIndex
CREATE INDEX "workout_template_exercise_templateId_idx" ON "workout_template_exercise"("templateId");

-- CreateIndex
CREATE INDEX "workout_session_userId_startedAt_idx" ON "workout_session"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "workout_session_userId_status_idx" ON "workout_session"("userId", "status");

-- CreateIndex
CREATE INDEX "session_exercise_sessionId_idx" ON "session_exercise"("sessionId");

-- CreateIndex
CREATE INDEX "session_exercise_exerciseId_idx" ON "session_exercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "set_log_sessionExerciseId_setNumber_key" ON "set_log"("sessionExerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "body_measurement_userId_date_idx" ON "body_measurement"("userId", "date");

-- CreateIndex
CREATE INDEX "water_log_userId_date_idx" ON "water_log"("userId", "date");

-- CreateIndex
CREATE INDEX "habit_userId_idx" ON "habit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "habit_check_habitId_date_key" ON "habit_check"("habitId", "date");

-- CreateIndex
CREATE INDEX "xp_event_userId_createdAt_idx" ON "xp_event"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "xp_event_userId_kind_refId_key" ON "xp_event"("userId", "kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_code_key" ON "achievement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievement_userId_achievementId_key" ON "user_achievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_code_key" ON "challenge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_challenge_userId_challengeId_weekStart_key" ON "user_challenge"("userId", "challengeId", "weekStart");

-- CreateIndex
CREATE INDEX "assistant_message_userId_createdAt_idx" ON "assistant_message"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_preference" ADD CONSTRAINT "food_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_goal" ADD CONSTRAINT "nutrition_goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food" ADD CONSTRAINT "food_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "nutrition_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food" ADD CONSTRAINT "food_purchaseFoodId_fkey" FOREIGN KEY ("purchaseFoodId") REFERENCES "food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food" ADD CONSTRAINT "food_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_planId_fkey" FOREIGN KEY ("planId") REFERENCES "meal_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_meal_item" ADD CONSTRAINT "planned_meal_item_plannedMealId_fkey" FOREIGN KEY ("plannedMealId") REFERENCES "planned_meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_meal_item" ADD CONSTRAINT "planned_meal_item_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_item" ADD CONSTRAINT "meal_log_item_mealLogId_fkey" FOREIGN KEY ("mealLogId") REFERENCES "meal_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_item" ADD CONSTRAINT "meal_log_item_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_record" ADD CONSTRAINT "price_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_record" ADD CONSTRAINT "price_record_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_planId_fkey" FOREIGN KEY ("planId") REFERENCES "meal_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_listId_fkey" FOREIGN KEY ("listId") REFERENCES "shopping_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_routine" ADD CONSTRAINT "workout_routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template" ADD CONSTRAINT "workout_template_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "workout_routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_exercise" ADD CONSTRAINT "workout_template_exercise_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workout_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_template_exercise" ADD CONSTRAINT "workout_template_exercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workout_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "session_exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_measurement" ADD CONSTRAINT "body_measurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_log" ADD CONSTRAINT "water_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit" ADD CONSTRAINT "habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_check" ADD CONSTRAINT "habit_check_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_challenge" ADD CONSTRAINT "user_challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_challenge" ADD CONSTRAINT "user_challenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_message" ADD CONSTRAINT "assistant_message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
