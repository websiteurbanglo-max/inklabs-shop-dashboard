"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateSlug, isValidSlug, debounce } from "@/lib/utils";

type Step = "choose" | "create-studio" | "join-shop";

interface SlugStatus {
  available?: boolean;
  checking?: boolean;
  error?: string;
}

export default function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [loading, setLoading] = useState(false);

  // Create studio form state
  const [studioName, setStudioName] = useState("");
  const [studioSlug, setStudioSlug] = useState("");
  const [studioEmail, setStudioEmail] = useState("");
  const [studioPhone, setStudioPhone] = useState("");
  const [studioDescription, setStudioDescription] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({});
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Join shop form state
  const [shopSlug, setShopSlug] = useState("");
  const [foundShop, setFoundShop] = useState<{
    shopId: string;
    displayName: string;
    shopType: string;
  } | null>(null);
  const [shopSearchError, setShopSearchError] = useState<string | null>(null);
  const [searchingShop, setSearchingShop] = useState(false);

  // Auto-generate slug from studio name
  useEffect(() => {
    if (!slugManuallyEdited && studioName) {
      setStudioSlug(generateSlug(studioName));
    }
  }, [studioName, slugManuallyEdited]);

  // Check slug availability
  const checkSlugAvailability = useRef(
    debounce(async (slug: string) => {
      if (!slug || !isValidSlug(slug)) return;

      setSlugStatus({ checking: true });
      try {
        const res = await fetch(
          `/api/onboarding/request-access?slug=${encodeURIComponent(slug)}`
        );
        if (res.status === 404) {
          // 404 from GET means the shop doesn't exist — slug is available
          setSlugStatus({ available: true });
        } else if (res.ok) {
          // 200 means shop exists — slug taken
          setSlugStatus({ available: false });
        } else {
          setSlugStatus({});
        }
      } catch {
        setSlugStatus({});
      }
    }, 600)
  ).current;

  useEffect(() => {
    if (studioSlug && isValidSlug(studioSlug)) {
      checkSlugAvailability(studioSlug);
    } else {
      setSlugStatus({});
    }
  }, [studioSlug, checkSlugAvailability]);

  // Search shop by slug (debounced)
  const searchShop = useRef(
    debounce(async (slug: string) => {
      if (!slug.trim()) {
        setFoundShop(null);
        setShopSearchError(null);
        return;
      }

      setSearchingShop(true);
      setFoundShop(null);
      setShopSearchError(null);

      try {
        const res = await fetch(
          `/api/onboarding/request-access?slug=${encodeURIComponent(slug.trim())}`
        );
        const data = await res.json();
        if (res.ok && data.shop) {
          setFoundShop(data.shop);
        } else {
          setShopSearchError("Shop not found. Please check the slug and try again.");
        }
      } catch {
        setShopSearchError("Failed to search. Please try again.");
      } finally {
        setSearchingShop(false);
      }
    }, 600)
  ).current;

  useEffect(() => {
    searchShop(shopSlug);
  }, [shopSlug, searchShop]);

  const handleCreateStudio = async () => {
    if (!studioName || !studioSlug || !studioEmail) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!isValidSlug(studioSlug)) {
      toast.error("Invalid slug format");
      return;
    }
    if (slugStatus.available === false) {
      toast.error("This slug is already taken");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/create-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: studioName,
          slug: studioSlug,
          email: studioEmail,
          phone: studioPhone || undefined,
          description: studioDescription || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create studio");
      }

      toast.success("Studio created! Awaiting platform approval.");
      router.push("/pending");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!foundShop) {
      toast.error("Please find a valid shop first");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: foundShop.shopId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to request access");
      }

      toast.success("Access request sent! Awaiting approval.");
      router.push("/pending");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "choose") {
    return (
      <div className="space-y-4">
        <div className="text-center mb-2">
          <h2 className="text-2xl font-bold text-gray-900">Get Started</h2>
          <p className="text-gray-500 text-sm mt-1">
            How would you like to use the platform?
          </p>
        </div>

        <Card
          hoverable
          className="p-6 cursor-pointer"
          onClick={() => setStep("create-studio")}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Create a New Studio
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                I want to create a new print studio account on the platform
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1 ml-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Card>

        <Card
          hoverable
          className="p-6 cursor-pointer"
          onClick={() => setStep("join-shop")}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Join an Existing Shop
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                I have a shop slug or code from an existing shop or Shopify store
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1 ml-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Card>
      </div>
    );
  }

  if (step === "create-studio") {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setStep("choose")}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            Create a New Studio
          </h2>
        </div>

        <div className="space-y-4">
          <Input
            label="Studio Name"
            required
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            placeholder="e.g., My Print Studio"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Studio Slug <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={studioSlug}
                onChange={(e) => {
                  setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  setSlugManuallyEdited(true);
                }}
                placeholder="my-print-studio"
                className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              {slugStatus.checking && (
                <svg
                  className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {slugStatus.available === true && (
                <svg className="absolute right-2.5 top-2.5 w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {slugStatus.available === false && (
                <svg className="absolute right-2.5 top-2.5 w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            {slugStatus.available === true && (
              <p className="text-xs text-green-600 mt-1">Slug is available!</p>
            )}
            {slugStatus.available === false && (
              <p className="text-xs text-red-600 mt-1">
                This slug is already taken. Please choose a different one.
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Lowercase letters, numbers and hyphens only, 3-30 characters
            </p>
          </div>

          <Input
            label="Contact Email"
            type="email"
            required
            value={studioEmail}
            onChange={(e) => setStudioEmail(e.target.value)}
            placeholder="you@yourstudio.com"
          />

          <Input
            label="Phone (Optional)"
            type="tel"
            value={studioPhone}
            onChange={(e) => setStudioPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={studioDescription}
              onChange={(e) => setStudioDescription(e.target.value)}
              placeholder="Tell us about your studio..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <Button
            onClick={handleCreateStudio}
            loading={loading}
            disabled={
              !studioName ||
              !studioSlug ||
              !studioEmail ||
              slugStatus.available === false ||
              slugStatus.checking
            }
            className="w-full mt-2"
          >
            Create Studio
          </Button>

          <p className="text-xs text-gray-400 text-center">
            Your studio will be reviewed and activated by the platform
            administrator.
          </p>
        </div>
      </Card>
    );
  }

  if (step === "join-shop") {
    return (
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setStep("choose")}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            Join an Existing Shop
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shop Slug or Shopify Domain
            </label>
            <div className="relative">
              <input
                type="text"
                value={shopSlug}
                onChange={(e) => setShopSlug(e.target.value)}
                placeholder="e.g., xyz-tattoo or cool-store.myshopify.com"
                className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchingShop && (
                <svg
                  className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
            </div>
          </div>

          {/* Found shop */}
          {foundShop && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 flex-shrink-0">
                {foundShop.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 text-sm">
                  {foundShop.displayName}
                </p>
                <p className="text-xs text-gray-500">{foundShop.shopId}</p>
              </div>
              <span
                className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  foundShop.shopType === "shopify"
                    ? "bg-green-100 text-green-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {foundShop.shopType}
              </span>
            </div>
          )}

          {/* Not found */}
          {shopSearchError && shopSlug && !searchingShop && (
            <p className="text-sm text-red-600 text-center">
              {shopSearchError}
            </p>
          )}

          <Button
            onClick={handleRequestAccess}
            loading={loading}
            disabled={!foundShop}
            className="w-full"
          >
            Request Access
          </Button>

          <p className="text-xs text-gray-400 text-center">
            Your request will be reviewed by the shop admin.
          </p>
        </div>
      </Card>
    );
  }

  return null;
}
