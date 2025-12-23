import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your account preferences and settings
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" defaultValue="John" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" defaultValue="Doe" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="john@example.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select defaultValue="utc-5">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc-8">Pacific Time (PT)</SelectItem>
                <SelectItem value="utc-5">Eastern Time (ET)</SelectItem>
                <SelectItem value="utc+0">Greenwich Mean Time (GMT)</SelectItem>
                <SelectItem value="utc+9">Japan Standard Time (JST)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-gray-500">
                Receive email updates about your progress
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sound Effects</Label>
              <p className="text-sm text-gray-500">
                Play sounds during practice sessions
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-save Progress</Label>
              <p className="text-sm text-gray-500">
                Automatically save your session progress
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Default Practice Duration</Label>
            <Select defaultValue="15">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="20">20 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy & Security</CardTitle>
          <CardDescription>
            Manage your data and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline">Change Password</Button>
          <Separator />
          <Button variant="outline">Download My Data</Button>
          <Separator />
          <Button variant="destructive">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
